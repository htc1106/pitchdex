# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Projects

### PolarGrid Website
- **Repo:** https://github.com/PolarGrid-AI/polargrid-website (canonical — use this)
- **Local path:** `~/.openclaw/workspace/polargrid-website/src`
- **Deploy:** push to `main` → Vercel auto-deploys (Vercel project: `polargrid-website`, org: `htc1106s-projects`)
- **Old monorepo:** `https://github.com/PolarGrid-AI/polargrid-monorepo.git` — no longer used for website deploys

---

Add whatever helps you do your job. This is your cheat sheet.

### PolarGrid Website

- **GitHub repo:** https://github.com/PolarGrid-AI/polargrid-website
- **Local path:** `~/.openclaw/workspace/polargrid-website/src` (deploy from here)
- **Deploy:** `cd ~/.openclaw/workspace/polargrid-website/src && vercel deploy --prod`
- **Changelogs file:** `lib/changelogs.tsx` (add newest entries first)
- **Changelog images:** `public/changelogs/<slug>.png`
- **Live URL pattern:** https://polargrid.ai/changelogs/<slug>
