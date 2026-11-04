# Lessons

One line per entry: the mistake, the rule that prevents it, the date.

- Index pages linked guides by bare slug, which resolved against /guides with trailing slashes off and broke every link; link within the site by absolute path (/guides/slug) and let tools/check-asset-names.py resolve served URLs the way the host does. 2026-11-03
- Meta descriptions were estimated by eye and ran past 160 characters twice; measure every description in a script before writing it, and rewrite rather than trim. 2026-11-03
- The GitHub Pages copy of the site was about to be switched off as a duplicate host while the shipped iOS and Android apps and the Play listing still open its privacy policy address; before retiring a host, path or domain, grep every shipped app, listing and test for its URL, and redirect rather than remove. 2026-11-04
