import sys
from difflib import unified_diff
from tempfile import TemporaryDirectory

import packaging.requirements

from tools import freeze_requirements


def main() -> int:
    # XXX: actually this won't work as we rely on pip-tools looking at the
    #      same outfile, so inside there we need to copy to dest dir
    with TemporaryDirectory() as tmpdir:
        rc = freeze_requirements.main("sentry", tmpdir)
        if rc != 0:
            print("There was an issue generating requirement lockfiles.")  # noqa
            return rc

        rc = 0
        for lockfile in (
            "requirements-frozen.txt",
            "requirements-dev-frozen.txt",
            "requirements-dev-only-frozen.txt",
        ):
            diff = tuple(
                unified_diff(
                    lockfile,
                    f"{tmpdir}/{lockfile}",
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
    raise SystemExit(main())
