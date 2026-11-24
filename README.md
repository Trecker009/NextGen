# NextGen Sales website

The NextGen Sales website: homepage, services, case studies, pricing, company, resources and legal pages, built on the NextGen Sales brand book and design system (navy, mist and signal aqua; Geist and Geist Mono).

Static site: plain HTML, CSS and JavaScript, no build step.

```
index.html          the homepage, and the master copy of the header and footer
*.html              33 more pages (services, case studies, pricing, playbooks, blog, legal, 404)
assets/styles.css   design tokens (dark and light), layout, components, sections
assets/main.js      menus, theme toggle, hero story, how-it-works funnel, hub, case studies, directory
assets/vendor       GSAP 3.13 (core, ScrollTrigger, Flip), served from the site; drives the scroll scenes and loops
assets/logos        tool logos; assets/people holds illustrative photos
scripts/sync-shell.py  copies the header and footer from index.html into every page
```

## Run it locally

```bash
python3 -m http.server 8770
```

Then open http://localhost:8770.

## Changing the header or footer

Edit it in `index.html`, between the `shell:top` or `shell:foot` markers, then run:

```bash
python scripts/sync-shell.py
```

## Review helpers

Add these to the URL to pin a state:

- `?open=services` (or `how`, `results`, `pricing`, `about`): pin a mega-menu open
- `?story=end`: show the hero story's final frame, or `?story=2.4` for any moment (0 to 3.6)
- `?how=0.6`: pin the how-it-works funnel at that point (0 to 1)

## Still to confirm before launch

- Client quotes in "in their words" are sample wording and are labelled as such.
- SDR photos are illustrative stock photos and are labelled as such.
- "Next free call" is worked out from the time of day. It is not connected to the calendar.
