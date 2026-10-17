# BLACKSUN // DIGITAL UNIVERSE

Responsive personal portfolio for OKAFOR VICTOR SOMTO. The site features a touch-friendly, horizontally scrollable project menu, live project previews, tool logos, hidden-on-load project support, Firebase sign-in, and a super-admin editor.

The hero portrait is an accessible, clickable toggle: both image changes use perspective-lit 3D shards to transition between Victor's portrait and `assets/victor-avatar.png`, with no on-image prompt. The account button uses the illustrated `victor-avatar.jpg`. Motion includes subtle orbiting artwork, pointer-reactive 3D tilt, staggered project cards, and scroll reveals; the portrait transition and other effects respect the device's reduced-motion preference.

The full-screen `assets/black-sun-abstract.png` background is revealed beneath a soft, moving cursor or touch mask. The canvas uses a cover fit, caps rendering at 2x device pixel ratio, fades after pointer movement stops, and remains pointer-transparent so site controls work normally. The reveal simplifies its interpolation for reduced-motion users and leaves the dark background in place if the image or canvas cannot load. It uses browser Canvas 2D and Pointer Events support available in current major browsers.

## Run locally

```bash
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3000`.

## Selected projects and previews

The maintained project list is in `portfolio-data.json`. It includes project repositories, live websites, and CodePen practice work with direct links. Projects without a confirmed working deployment are marked `Unverified`. Their submitted direct links remain available, and CodePen embeds are shown as project previews when possible.

Live previews are loaded in an iframe only after the matching project is selected. Some external sites may block iframe embedding; the direct live-project and GitHub links remain available.

## Firebase sign-in, admin edits, and update emails

The account UI uses Firebase Authentication for Google and email/password sign-in. Email/password registrations trigger Firebase's verification email. Only the email configured in `ADMIN_EMAIL`, after Firebase reports that its email is verified, can access the admin editor or save website changes. Other verified accounts may explicitly opt in to project-update emails.

1. Create a Firebase project.
2. In Firebase Authentication, enable **Google** and **Email/Password** providers and add the deployed site domain to Authorized domains.
3. Create a Cloud Firestore database.
4. Create a Firebase service account and provide its JSON to the backend as `FIREBASE_SERVICE_ACCOUNT_JSON`. Keep this credential only in the server's environment.
5. Copy the Firebase web app values into the `FIREBASE_*` variables in `.env`.
6. Set `ADMIN_EMAIL` to the single super-admin email. Register that address in the site and verify it through Firebase's email.
7. Configure `EMAIL_SERVICE`, `EMAIL_USER`, and `EMAIL_PASSWORD` so the backend can send portfolio update notices and contact-form messages.

Edit `.env` (or copy `.env.example` to recreate it) and replace each `REPLACE_WITH_...` value. The required settings are labeled in the file; `.env` is ignored by Git and should never be committed. Placeholder values are treated as unset by the server until you replace them.

The admin workspace includes a project form for adding, updating, and removing projects, plus a full JSON editor for the rest of the portfolio content. Each project must include a GitHub repository URL or live project URL. If a repository URL is entered, it must be a repository owned by `Linxvicky2049`. Draft edits are published only after selecting **Save website updates**. The server validates projects, stores saved content in Firestore, and emails opted-in verified subscribers after a successful save. Never place the Firebase service-account JSON or SMTP password in frontend code or source control.

## Deployment

GitHub Pages can serve the static portfolio and `portfolio-data.json`, but it cannot run Express, verify Firebase ID tokens, persist admin changes, or send update/contact emails. For the integrated admin and auth features, deploy the Express app and frontend together on a Node.js host (for example Render or Railway), and configure all server environment variables there.

If the frontend and backend are hosted separately, set `window.BLACKSUN_API_URL` in `index.html` to the backend's HTTPS origin and set `CORS_ORIGIN` to the exact frontend origin.

## CV files

The existing resume is preserved at `assets/OKAFOR_VICTOR_SOMTO_Resume.docx` and copied to `assets/cv/OKAFOR_VICTOR_SOMTO_CV.docx`. A verified PDF source has not been provided; the project does not generate a fabricated PDF.

## Checks

```bash
node --check server.js
node --check script.js
npm start
```

The contact API returns a direct-email fallback when SMTP credentials are missing. Firebase login and persistent admin editing require the Firebase settings and service account described above.
