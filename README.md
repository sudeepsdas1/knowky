# Knowky 🧠⭐

A fun general-knowledge app for kids aged 5–13.

- **Knowky Facts**: swipe up and down through fact cards. Each card has a picture, a topic, a short fact and a "Tell me more" explanation. You earn ⭐ points for every new fact (+10) and every explanation you open (+5).
- **Trivia, Global Topics**: type a topic (for example "Planets" or "Sharks") and post it, or join a topic someone else posted. You get 20 questions with 30 seconds each, and whoever gets the most right wins.
- **Random Trivia**: a match with mixed general-knowledge questions, no topic needed.
- **Solo Mode**: practise alone on any topic, with 10 or 20 questions.
- **Profile**: your name, avatar, discovery points, trivia rating (+30 for a win, −20 for a loss, +5 for a draw), record and recent games.

> **No database:** Knowky doesn't save anything. Everything is kept in memory and resets when the app is closed. Because there's no server, the other players in Trivia are simulated on the phone, so the app works fully offline.

---

## Get the APK using GitHub (no Android Studio needed)

GitHub builds the APK for you for free with **GitHub Actions**. The file `.github/workflows/build-apk.yml` contains the build instructions.

### Step 1: Create a GitHub account and an empty repository
1. Go to <https://github.com> and sign up, or log in.
2. Click the **+** at the top right, then **New repository**.
3. Name it `knowky`. Choose **Public** (unlimited free builds) or **Private** (2,000 free build minutes a month, which is plenty).
4. **Don't** tick "Add a README", ".gitignore" or "license". Leave it empty.
5. Click **Create repository**.

### Step 2: Put the code on GitHub
Pick **one** of the options below.

#### Option A: Upload in the browser (easiest)
1. Unzip `knowky.zip` on your computer. You'll get a folder called `knowky`.
2. **Show hidden files**, because the important `.github` folder starts with a dot and is hidden by default:
   - **Windows:** in File Explorer, go to **View → Show → Hidden items**.
   - **Mac:** in Finder, press **Cmd + Shift + .** (full stop).
3. On your new repository page, click the link **"uploading an existing file"**.
4. Open the `knowky` folder, select **everything inside it** (`.github`, `android`, `www`, `package.json`, and so on), and drag it onto the GitHub page. Drag the files *inside* the folder, not the `knowky` folder itself.
5. Wait for the upload to finish, then click **Commit changes**.
6. **Check:** the repository's file list should show a `.github` folder. If it doesn't:
   1. Click **Add file → Create new file**.
   2. In the name box, type `.github/workflows/build-apk.yml`. The slashes create the folders.
   3. Open `knowky/.github/workflows/build-apk.yml` from the zip in Notepad or TextEdit, copy everything, and paste it into GitHub.
   4. Click **Commit changes**.

#### Option B: Use Git on the command line
Install Git from <https://git-scm.com>, then open a terminal inside the unzipped `knowky` folder:

```bash
git init
git add .
git commit -m "Knowky app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/knowky.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your GitHub username. If Git asks for a password, use a **Personal Access Token**, not your account password. To make one, go to GitHub **Settings → Developer settings → Personal access tokens**. GitHub Desktop (<https://desktop.github.com>) also works if you prefer clicking to typing.

### Step 3: Let GitHub build the APK
1. Open the **Actions** tab of your repository.
2. If GitHub asks, click **"I understand my workflows, go ahead and enable them"**.
3. The build **Build Knowky APK** starts automatically after every upload or push. To start one by hand, click **Build Knowky APK → Run workflow**.
4. Wait about 5–10 minutes until it shows a green ✅.

### Step 4: Download the APK
Use either of these:
- **Releases (direct APK):** on the repository's main page, look at the right side for **Releases**. Open **Knowky build N** and download **Knowky.apk**.
- **Actions tab:** click the finished run, scroll to **Artifacts**, and download **Knowky-APK**. It comes as a `.zip`, so unzip it to get `Knowky.apk`.

### Step 5: Install it on an Android phone
1. Copy `Knowky.apk` to the phone, or download it on the phone directly from the Releases page.
2. Tap the file. If Android asks, allow **"Install unknown apps"** for your browser or Files app.
3. Google Play Protect may say the app is from an unknown developer. Tap **More details → Install anyway**. This is normal for apps that aren't from the Play Store.
4. Open **Knowky** 🎉

---

## Making changes
- **Facts:** edit `www/js/data-facts.js`.
- **Trivia questions and topics:** edit `www/js/data-questions.js`. Write the correct answer first; the app shuffles the options. Each topic needs at least 20 questions. The `keywords` list controls which typed topics map to it.
- **Design:** edit `www/css/styles.css`.
- **App logic:** edit `www/js/app.js`.

To preview changes on your computer, open `www/index.html` in Chrome. Press F12 and turn on the phone view with the device toolbar. Commit or push the changes and GitHub builds a new APK automatically.

## Troubleshooting
| Problem | Fix |
|---|---|
| Nothing appears in the Actions tab | The `.github/workflows/build-apk.yml` file is missing. Follow Step 2 → Option A → point 6. |
| Build fails at "Publish APK on the Releases page" with *Resource not accessible by integration* | Go to repository **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, save, and re-run the build. Even when this step fails, you can still download the APK from **Artifacts**. |
| Build fails at "Install packages" | Make sure both `package.json` and `package-lock.json` were uploaded. |
| "App not installed" on the phone | Uninstall any older Knowky first, then install again. |

## Notes
- The APK is a **debug build**. It's fine for installing and sharing, but the Google Play Store needs a *signed release build* (`.aab`) instead.
- Built with plain HTML/CSS/JavaScript, wrapped as an Android app with [Capacitor](https://capacitorjs.com).

## Project structure
```
knowky/
├── .github/workflows/build-apk.yml   ← GitHub builds the APK with this
├── android/                          ← Android project (generated by Capacitor, custom icon & splash)
├── www/                              ← the app itself
│   ├── index.html
│   ├── css/styles.css
│   ├── fonts/                        ← bundled fonts (works offline)
│   └── js/
│       ├── app.js                    ← all app logic
│       ├── data-facts.js             ← 48 fact cards
│       ├── data-questions.js         ← 8 topics × 20 questions
│       └── vendor/                   ← Capacitor runtime (Android back button)
├── capacitor.config.json
├── package.json / package-lock.json
└── README.md
```
