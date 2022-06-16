import argparse
import sys
from difflib import unified_diff
from tempfile import TemporaryDirectory
from typing import Optional, Sequence

from tools import freeze_requirements


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repo", type=str, help="Repository name.")
    args = parser.parse_args(argv)
    repo = args.repo

    with TemporaryDirectory() as tmpdir:
        rc = freeze_requirements.main(repo, tmpdir)
        if rc != 0:
            print("There was an issue generating requirement lockfiles.")  # noqa
            return rc

        rc = 0
        lockfiles = [
            "requirements-frozen.txt",
            "requirements-dev-frozen.txt",
        ]
        if repo == "sentry":
            # requirements-dev-only-frozen.txt is only used in sentry
            # (and reused in getsentry) as a fast path for some CI jobs.
            lockfiles.append("requirements-dev-only-frozen.txt")

        for lockfile in lockfiles:
            with open(lockfile) as f:
                current = f.readlines()
            with open(f"{tmpdir}/{lockfile}") as f:
                new = f.readlines()
            diff = tuple(
                unified_diff(
                    current,
                    new,
                    fromfile=f"current {lockfile}",
                    tofile=f"new {lockfile}",
                )
            )
            if not diff:
                continue

            rc = 1
            sys.stdout.writelines(diff)

        if rc != 0:
            print(  # noqa
                """
Requirement lockfiles are mismatched. To regenerate them,
use `make freeze-requirements`.
"""
            )
            return rc

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
