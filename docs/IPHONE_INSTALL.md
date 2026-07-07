# Install Nouvel on iPhone (free, no App Store)

Nouvel is a **web app** you install from Safari — like a lightweight app bundle on your home screen. You need a **public HTTPS link** (not localhost).

## Step 1 — Deploy once (free on Render)

1. Push this repo to **GitHub**.
2. Go to [render.com](https://render.com) → sign up (free).
3. **New → Blueprint** → select your GitHub repo.
4. When asked for env vars:
   - `ALLOWED_EMAILS` → your email (e.g. `you@gmail.com`) so you can sign up
   - `OPENAI_API_KEY` → leave blank for offline AI, or add your key
5. Click **Deploy**. Wait ~5 minutes.
6. Copy your live URL, e.g. `https://nouvel-xxxx.onrender.com`.

> Free tier sleeps after ~15 min idle. First open may take ~30 seconds to wake up.

## Step 2 — Install on iPhone

1. Open **Safari** on iPhone (must be Safari, not Chrome).
2. Go to your Render URL.
3. Tap **Share** (square with arrow at the bottom).
4. Scroll down → tap **Add to Home Screen**.
5. Tap **Add**.

Nouvel now appears on your home screen with an icon and opens **full screen** (no browser bar) — like a native app.

## Step 3 — Use it

- Open from the home screen icon (not a bookmark in Safari).
- Sign up with the email you put in `ALLOWED_EMAILS`.
- Your data stays on the Render server (same account on any device).

## Notifications

Profile reminder settings are saved, but **push alerts are not wired yet**. Installing the app does not enable notifications until that feature is added.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Email not allowed" on signup | Add your email to `ALLOWED_EMAILS` in Render dashboard → redeploy |
| Blank page / slow first load | Free Render service was asleep — wait 30s and refresh |
| No "Add to Home Screen" | Use Safari, not Chrome |
| Data lost after redeploy | Free SQLite on Render resets on redeploy — normal for testing |

## Alternatives to Render (also free)

- **Cloudflare Pages + Workers** — more setup
- **Railway / Fly.io** — similar one-click deploy

Render is recommended because this repo already includes `render.yaml`.
