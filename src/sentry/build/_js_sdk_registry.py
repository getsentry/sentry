from __future__ import annotations

import argparse
import json
import os.path

from sentry.build._download import urlopen_with_retries

_HERE = os.path.dirname(os.path.abspath(__file__))
_TARGET = os.path.join(_HERE, "..", "loader")


def _download(dest: str) -> None:
    resp = urlopen_with_retries(
        "https://release-registry.services.sentry.io/sdks/sentry.javascript.browser/versions"
    )
    data = json.load(resp)
    with open(os.path.join(dest, "_registry.json"), "w", encoding="UTF-8") as f:
        json.dump(data, f, indent=2)


def main() -> int:  # convenience to debug with `python -m ...`
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", default=_TARGET)
    args = parser.parse_args()

    _download(args.dest)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
