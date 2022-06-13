import os.path
import re
import subprocess

PATCH_FILE_PATTERN = (
    (
        "scripts/patches/chrome_options.diff",
        ".venv/lib/python3.8/site-packages/selenium/webdriver/chrome/options.py",
        re.compile(r"path to the \\\*\.crx file"),
    ),
    (
        "scripts/patches/firefox_profile.diff",
        ".venv/lib/python3.8/site-packages/selenium/webdriver/firefox/firefox_profile.py",
        re.compile(r"setting is ''"),
    ),
    (
        "scripts/patches/remote_webdriver.diff",
        ".venv/lib/python3.8/site-packages/selenium/webdriver/remote/webdriver.py",
        re.compile(r' """Finds an element by id'),
    ),
    (
        "scripts/patches/remote_webelement.diff",
        ".venv/lib/python3.8/site-packages/selenium/webdriver/remote/webelement.py",
        re.compile(r' """Finds element within this element\'s children by ID'),
    ),
    (
        "scripts/patches/support_wait.diff",
        ".venv/lib/python3.8/site-packages/selenium/webdriver/support/wait.py",
        re.compile(r"\.\\ \\n"),
    ),
)


def main() -> int:
    for patch, filename, pattern in PATCH_FILE_PATTERN:
        if not os.path.exists(filename):
            print(f"patch_selenium: ignoring {filename} (does not exist)")
            continue

        with open(filename) as f:
            for line in f:
                if pattern.search(line):
                    break
            else:  # did not find the pattern
                continue

        print(f"patching {filename}, you will only see this once")
        sentry_root = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        patch = os.path.join(sentry_root, patch)
        if subprocess.call(("patch", "-f", "-p0", "-i", patch)):
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
