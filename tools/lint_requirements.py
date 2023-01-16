from __future__ import annotations

import argparse
from typing import Sequence

import packaging.requirements


def main(argv: Sequence[str] | None = None) -> int:
    """
    We cannot have non-specifier requirements if we want to publish to PyPI
    due to security concerns. This check ensures we don't have/add any URL/VCS
    dependencies in the base requirements file.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("filenames", nargs="*")
    args = parser.parse_args(argv)

    for filename in args.filenames:
        with open(filename) as reqs_file:
            for lineno, line in enumerate(reqs_file, start=1):
                line = line.strip()
                if not line or line.startswith(("--", "#")):
                    continue

                invalid_requirement = False
                try:
                    req = packaging.requirements.Requirement(line)
                except packaging.requirements.InvalidRequirement:
                    invalid_requirement = True
                else:
                    invalid_requirement = bool(req.url)

                if invalid_requirement:
                    raise SystemExit(
                        f"You cannot use dependencies that are not on PyPI directly.\n"
                        f"See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references\n\n"
                        f"{reqs_file.name}:{lineno}: {line}"
                    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
