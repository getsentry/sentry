from __future__ import annotations

import argparse
import glob
import os.path
import re
import subprocess
import sys
from typing import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action")
    parser.add_argument("version")
    parser.add_argument("--base-dir", default=".")
    args = parser.parse_args(argv)

    reg = re.compile(f"(?<=uses: {re.escape(args.action)}@).*$", re.M)

    filenames = [
        filename
        for yml_glob in (".github/workflows/*.yml", ".github/actions/*/*.yml")
        for filename in glob.glob(os.path.join(args.base_dir, yml_glob))
    ]

    changed = []
    for filename in filenames:
        with open(filename) as f:
            original_contents = f.read()
            contents = reg.sub(args.version, original_contents)

        if contents != original_contents:
            print(f"{filename} upgrading {args.action}...")
            changed.append(filename)
            with open(filename, "w") as f:
                f.write(contents)

    if changed:
        print("freezing...")
        return subprocess.call((sys.executable, "-m", "tools.pin_github_action", *changed))
    else:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
