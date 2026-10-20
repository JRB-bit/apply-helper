# Apply Helper

A Safari extension that makes job applications faster. It learns your answers the first time you type them and fills them in on every application after that.

- **Learns as you go.** Every answer you type or pick is saved. A small "Learned…" note confirms it.
- **One answer, many wordings.** "Email", "Email address" and "E-mail *" share one saved answer. The same goes for name, phone, links, school, work authorization, sponsorship, EEO questions and more.
- **Custom questions** are matched by wording. Answers taken from a similar but not identical question, and long essay answers, are outlined in amber so you can check them.
- **Fills automatically** on job sites (Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters and others). Elsewhere a **Fill** button appears instead, and **Control-Shift-F** works anywhere.
- **Attaches your résumé** to the résumé upload box, never the cover letter box.
- **LinkedIn referral check.** On a profile, it shows whether the person works at your target company and is US-based, then fills in your connection note for you to copy. It never clicks or sends anything for you.
- **Private.** Everything is stored locally in Safari. Nothing is sent anywhere. It never saves passwords, SSNs, card or bank numbers, or dates of birth, and never ticks "I agree" or "I certify" boxes for you.

## Install

You need a Mac with Xcode.

1. Clone this repo:
   ```
   git clone https://github.com/<you>/apply-helper.git ~/Documents/apply-helper
   ```
2. Turn it into a Safari app (this creates the Xcode project):
   ```
   xcrun safari-web-extension-converter ~/Documents/apply-helper/Extension\ Resources --macos-only --app-name "Apply Helper" --project-location ~/Documents
   ```
3. Xcode opens. Press **⌘R** to build and run.
4. In Safari:
   - **Settings → Advanced:** tick **Show features for web developers**.
   - **Settings → Developer:** tick **Allow unsigned extensions**.
   - **Settings → Extensions:** tick **Apply Helper**, then click **Always Allow on Every Website**.

So you don't have to re-allow unsigned extensions every time Safari restarts, set your own **Team** under **Signing & Capabilities** for both targets in Xcode.

## Use

- Fill out your first application normally. That teaches it your answers.
- On later applications, answers fill in automatically and are outlined in gold.
- Click the toolbar icon to see, edit or delete saved answers, pause it on a site, or back up and restore your data.
- Open **Résumé & referral settings** to upload your résumé and set the LinkedIn referral company, role and note.

## Known limits

- Some sites, such as Workday, use custom drop-down menus instead of standard ones, so those menus may not fill. Text boxes still do.
- LinkedIn changes its layout often. If the referral check shows "?", scroll down to Experience and click **Re-check**.

## Project layout

```
Extension Resources/
  manifest.json         extension config
  content.js            learning + autofill (runs on every page)
  content-linkedin.js   referral check on LinkedIn profiles
  background.js         keyboard shortcut, first-run defaults
  popup.*               toolbar popup: saved answers and settings
  settings.*            résumé and referral settings page
  panel.css             LinkedIn panel styles
  images/               icons
icon/                   icon source (SVG)
```

## License

MIT
