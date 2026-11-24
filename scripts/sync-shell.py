"""Copy the shared header and footer from index.html into every other page.

The site has no build step. Pages are plain HTML and can be edited by hand;
only the blocks between the shell:top and shell:foot markers are shared.
After changing the header, menus, closing panel or footer in index.html, run:

    python scripts/sync-shell.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOP = re.compile(r"<!-- shell:top.*?<!-- /shell:top -->", re.S)
FOOT = re.compile(r"<!-- shell:foot -->.*?<!-- /shell:foot -->", re.S)


def for_subpage(html):
    """Anchors that live on the homepage need its file name in front."""
    def fix(m):
        before, anchor = m.group(1), m.group(2)
        if anchor == "book":
            return m.group(0)  # every page ends with its own booking panel
        if anchor in ("", "top"):
            return before + 'index.html"'
        if anchor == "calculator":
            return before + 'pricing.html#calculator"'
        return f'{before}index.html#{anchor}"'
    return re.sub(r'(<a\b[^>]*?href=")#([\w-]*)"', fix, html)


def main():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    top = for_subpage(TOP.search(index).group(0))
    foot = for_subpage(FOOT.search(index).group(0))
    count = 0
    for page in sorted(ROOT.glob("*.html")):
        if page.name == "index.html":
            continue
        old = page.read_text(encoding="utf-8")
        new = FOOT.sub(lambda _: foot, TOP.sub(lambda _: top, old))
        if new != old:
            page.write_text(new, encoding="utf-8", newline="\n")
            count += 1
    print(f"{count} pages updated")


if __name__ == "__main__":
    main()
