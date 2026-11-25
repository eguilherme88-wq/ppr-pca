# Partner: gerenciamento em PPR e PCA

Sistema de controle do Programa de Proteção Respiratória (PPR) e do Programa de Conservação Auditiva (PCA): trabalhadores e GHE, audiometrias com análise evolutiva (NR-7, Anexo II), ruído, agentes químicos, ensaios de vedação, EPIs, treinamentos, relatórios e integração com o Sistema SST.

## Onde roda

| Aparelho | Como instalar |
|---|---|
| Windows | `Partner-PPR-PCA-Setup-x.y.z.exe` (página **Releases**) |
| Linux | `.AppImage` (qualquer distribuição: dar permissão de execução e abrir) ou `.deb` (Ubuntu/Debian: `sudo apt install ./arquivo.deb`) |
| Celular e tablet Android | `Partner-PPR-PCA-Android.apk` (Releases). Permitir "instalar apps desconhecidos" para o navegador ou gerenciador de arquivos |
| iPhone e iPad | Abrir a versão web no Safari > Compartilhar > **Adicionar à Tela de Início** |
| Qualquer navegador | Versão web (GitHub Pages). Chrome e Edge mostram o botão **Instalar app** na barra de endereço |

Os instaladores são gerados automaticamente pelo GitHub Actions ao criar uma tag de versão:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

O workflow **Gerar instaladores** compila Windows, Linux e Android e anexa tudo a uma Release. Também pode ser executado manualmente em *Actions > Gerar instaladores > Run workflow* (os arquivos ficam em *Artifacts*).

## Acesso por biometria

Depois de entrar com login e senha, o botão **Biometria** (canto superior) ativa o acesso biométrico **neste aparelho**:

- Android: digital ou reconhecimento facial (plugin nativo).
- Windows: Windows Hello (digital, rosto ou PIN), no app instalado e no Chrome/Edge.
- iPhone, iPad e Mac: Face ID / Touch ID pela versão web.
- Linux: em geral não há leitor biométrico integrado; o acesso continua por senha.

A biometria nunca sai do aparelho. Cada aparelho guarda a biometria de um usuário; a senha continua valendo. Se a senha do usuário for redefinida ou ele for inativado, a biometria deixa de funcionar.

## Banco de dados (Firebase)

Sem configuração, os dados ficam só no aparelho. Para compartilhar entre computadores, celulares e tablets:

1. No [Console do Firebase](https://console.firebase.google.com), com a conta da empresa, crie o projeto (sugestão: `partner-ppr-pca`).
2. **Build > Firestore Database > Criar banco de dados** (modo produção, região `southamerica-east1`, São Paulo).
3. **Build > Authentication > Começar > E-mail/senha > Ativar**. Em *Users > Add user*, crie a conta da empresa (ex.: `emoraesguilherme78@gmail.com` com uma senha forte).
4. Em **Authentication > Settings > User actions**, desmarque *Enable create (sign-up)* para impedir cadastros de fora.
5. **Firestore > Regras**: cole o conteúdo de `firestore.rules` e publique. Somente os e-mails listados ali acessam os dados.
6. **Configurações do projeto > Seus apps > Web (`</>`)**: registre o app e copie o objeto `firebaseConfig`.
7. No GitHub, em **Settings > Secrets and variables > Actions > New repository secret**, crie o secret `FIREBASE_CONFIG_JS` com o conteúdo completo do arquivo `www/firebase-config.js` já preenchido. A configuração não fica no código; os builds e a versão web a recebem por esse secret.

Na primeira abertura de cada aparelho, o sistema pede o e-mail e a senha da **conta da empresa** (uma vez só). Depois aparece o login normal dos usuários do sistema, com níveis de acesso, matriz de permissões e biometria.

Com a Firebase CLI, os passos 5 e a hospedagem podem ser feitos por linha de comando:

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # escolha o projeto
firebase deploy --only firestore:rules,hosting
```

## Desenvolvimento

```bash
npm install
npm start            # app de computador (Electron)
npm run dist:win     # instalador Windows (rodar no Windows)
npm run dist:linux   # AppImage e .deb
npm run android:add && npm run android:build   # requer Android SDK e JDK 21
```

Estrutura:

- `www/` app web (index.html, `js/platform.js` com Firebase e biometria, `sw.js` para uso offline, `manifest.webmanifest`)
- `electron/` app de computador (serve `www` em `localhost`, necessário para a biometria funcionar)
- `capacitor.config.json` app Android
- `firestore.rules` regras de segurança do banco

## Avisos

- O controle de usuários do sistema é feito no aplicativo; a proteção dos dados na nuvem vem do login da conta da empresa e das regras do Firestore.
- Os dados de audiometria são dados de saúde (dados sensíveis pela LGPD). A empresa usuária é a controladora e responde pelo controle de acesso.
- O APK é assinado com chave de depuração, adequado para distribuição interna. Para publicar na Google Play é preciso uma chave de assinatura própria.

© 2026 Partner. Todos os direitos reservados.
