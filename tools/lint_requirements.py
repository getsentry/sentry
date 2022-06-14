import sys
from difflib import unified_diff
from tempfile import TemporaryDirectory

import packaging.requirements

from tools import freeze_requirements


def main(repo: str) -> int:
    IS_GETSENTRY = repo == "getsentry"

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
        if not IS_GETSENTRY:
            lockfiles.append("requirements-dev-only-frozen.txt")
        for lockfile in lockfiles:
            with open(lockfile) as f:
                original = f.readlines()
            with open(f"{tmpdir}/{lockfile}") as f:
                new = f.readlines()
            diff = tuple(
                unified_diff(
                    original,
                    new,
                    fromfile=lockfile,
                    tofile="newly generated lockfile",
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

    if not IS_GETSENTRY:
        return 0

    """
    We cannot have non-specifier requirements if we want to publish to PyPI
    due to security concerns. This check ensures we don't have/add any URL/VCS
    dependencies in the base requirements file.
    """
    with open("requirements-frozen.txt") as reqs_file:
        for lineno, line in enumerate(reqs_file, start=1):
            line = line.strip()
            line, _, _ = line.partition("#")
            if not line:
                continue

            try:
                packaging.requirements.Requirement(line)
            except packaging.requirements.InvalidRequirement:
                raise SystemExit(
                    f"You cannot use dependencies that are not on PyPI directly.\n"
                    f"See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references\n\n"
                    f"{reqs_file.name}:{lineno}: {line}"
                )

    return 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("repo", type=str, help="Repository name.")
    args = parser.parse_args()
    raise SystemExit(main(args.repo))
