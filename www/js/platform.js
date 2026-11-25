/* Partner PPR/PCA — camada de plataforma
 * - Firebase (Firestore + Authentication) como banco na nuvem
 * - Biometria: nativa no Android (Capacitor) e WebAuthn (Windows Hello, Touch ID, Face ID, digital) no navegador/PC
 * - Service worker (PWA instalável e funcionamento offline)
 */
(function () {
  'use strict';
  const FB_V = '10.13.2';
  const cfg = () => window.FIREBASE_CONFIG || {};
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const isElectron = () => /Electron/i.test(navigator.userAgent);

  /* ---------------- Firebase ---------------- */
  let fb = null; // { app, auth, fs, m: módulos }
  async function fbInit() {
    if (fb) return fb;
    const appM = await import(`https://www.gstatic.com/firebasejs/${FB_V}/firebase-app.js`);
    const authM = await import(`https://www.gstatic.com/firebasejs/${FB_V}/firebase-auth.js`);
    const fsM = await import(`https://www.gstatic.com/firebasejs/${FB_V}/firebase-firestore.js`);
    const app = appM.getApps().find(a => a.name === '[DEFAULT]') || appM.initializeApp(cfg());
    let fs;
    try {
      fs = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
    } catch (_) { fs = fsM.getFirestore(app); }
    const auth = authM.getAuth(app);
    try { await authM.setPersistence(auth, authM.browserLocalPersistence); } catch (_) {}
    fb = { app, auth, fs, m: { ...authM, ...fsM } };
    return fb;
  }
  function onAuth(cb) { return fb.m.onAuthStateChanged(fb.auth, cb); }
  async function signIn(email, senha) { return fb.m.signInWithEmailAndPassword(fb.auth, email, senha); }
  async function resetSenha(email) { return fb.m.sendPasswordResetEmail(fb.auth, email); }
  async function signOut() { return fb.m.signOut(fb.auth); }

  // Adaptador com a mesma interface usada pelo app (collection().add/onSnapshot, doc().set/delete/onSnapshot)
  function makeDb() {
    const { m, fs } = fb;
    const wrapDoc = d => ({ id: d.id, data: () => d.data(), exists: d.exists() });
    return {
      collection(c) {
        const ref = m.collection(fs, c);
        return {
          add: obj => m.addDoc(ref, clean(obj)),
          onSnapshot: (ok, err) => m.onSnapshot(ref, s => ok({ docs: s.docs.map(wrapDoc) }), err)
        };
      },
      doc(path) {
        const ref = m.doc(fs, path);
        return {
          set: o => m.setDoc(ref, clean(o)),
          delete: () => m.deleteDoc(ref),
          onSnapshot: (ok, err) => m.onSnapshot(ref, s => ok(wrapDoc(s)), err)
        };
      }
    };
  }
  // Firestore não aceita undefined
  const clean = o => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)));

  /* ---------------- Biometria ---------------- */
  const BKEY = 'ppr-pca-biometria';
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  function bioSaved() { try { return JSON.parse(localStorage.getItem(BKEY) || 'null'); } catch (_) { return null; } }
  function bioSave(v) { try { v ? localStorage.setItem(BKEY, JSON.stringify(v)) : localStorage.removeItem(BKEY); } catch (_) {} }
  let nativeBio = null;
  function nb() {
    if (!nativeBio && isNative()) {
      const C = window.Capacitor;
      nativeBio = (C.Plugins && C.Plugins.NativeBiometric) || (C.registerPlugin ? C.registerPlugin('NativeBiometric') : null);
    }
    return nativeBio;
  }
  async function bioAvailable() {
    try {
      if (isNative()) { if (!nb()) return false; const r = await nb().isAvailable({ useFallback: false }); return !!(r && r.isAvailable); }
      if (!window.PublicKeyCredential || !window.isSecureContext) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (_) { return false; }
  }
  async function bioVerify(reason) {
    if (isNative()) { await nb().verifyIdentity({ reason, title: 'Partner PPR e PCA', subtitle: reason, description: '' }); return true; }
    return false;
  }
  // Cadastra a biometria deste aparelho para o usuário
  async function bioEnable(u) {
    if (isNative()) {
      await bioVerify('Confirme sua biometria para ativar o acesso');
      bioSave({ userId: u.id, login: u.login, nome: u.nome, tipo: 'nativa', em: new Date().toISOString() });
      return true;
    }
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: rnd(32),
      rp: { name: 'Partner PPR e PCA' },
      user: { id: new TextEncoder().encode(u.id), name: u.login, displayName: u.nome },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none'
    } });
    bioSave({ userId: u.id, login: u.login, nome: u.nome, tipo: 'webauthn', credId: b64(cred.rawId), em: new Date().toISOString() });
    return true;
  }
  // Retorna o id do usuário se a biometria for confirmada
  async function bioLogin() {
    const s = bioSaved(); if (!s) throw new Error('Biometria não cadastrada neste aparelho.');
    if (s.tipo === 'nativa') { await bioVerify('Entrar no Partner'); return s.userId; }
    const a = await navigator.credentials.get({ publicKey: {
      challenge: rnd(32), timeout: 60000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: unb64(s.credId), transports: ['internal', 'hybrid'] }]
    } });
    if (!a || b64(a.rawId) !== s.credId) throw new Error('Credencial biométrica não reconhecida.');
    return s.userId;
  }

  /* ---------------- PWA ---------------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isNative()) {
    window.addEventListener('load', () => navigator.serviceWorker.register('partner-ppr-pca-sw.js', { scope: './' }).catch(() => {}));
  }

  window.Platform = {
    firebaseConfigured: () => !!(cfg().apiKey && cfg().projectId),
    fbInit, onAuth, signIn, signOut, resetSenha, makeDb,
    currentUser: () => (fb ? fb.auth.currentUser : null),
    projectId: () => cfg().projectId || '',
    bioAvailable, bioEnable, bioLogin, bioSaved, bioClear: () => bioSave(null),
    isNative, isElectron,
    plataforma: () => (isNative() ? 'Android' : isElectron() ? 'Computador (app)' : 'Navegador')
  };
})();
