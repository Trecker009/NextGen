# NextGen Sales website

Homepage and navigation for NextGen Sales, built on the NextGen Sales brand book and design system (navy, mist and signal aqua; Geist and Geist Mono).

Static site: plain HTML, CSS and JavaScript, no build step.

```
index.html          the homepage
assets/styles.css   design tokens (dark and light), layout, components, sections
assets/main.js      menus, theme toggle, hero story, how-it-works funnel, hub, case studies
```

## Run it locally

```bash
python3 -m http.server 8770
```

Then open http://localhost:8770.

## Review helpers

Add these to the URL to pin a state:

- `?open=services` (or `how`, `results`, `pricing`, `about`): pin a mega-menu open
- `?story=end`: show the hero story's final frame
- `?how=0.6`: pin the how-it-works funnel at that point (0 to 1)

## Placeholders

Figures, names and quotes marked with a dashed underline (class `tbc`) are placeholders waiting for confirmed client data.
