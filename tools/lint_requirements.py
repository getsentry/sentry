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
    allow_url_reqs = False

    for filename in args.filenames:
        with open(filename) as reqs_file:
            for lineno, line in enumerate(reqs_file, start=1):
                line = line.strip()
                if not line or line.startswith(("--", "#")):
                    if "lint-requirements:" in line:
                        if "allow(url-reqs)" in line:
                            allow_url_reqs = True
                        elif "deny(url-reqs)" in line:
                            allow_url_reqs = False
                        else:
                            raise Exception(f"Unrecognized directive: {line}")
                    continue

                if allow_url_reqs:
                    continue

                try:
                    req = packaging.requirements.Requirement(line)
                except packaging.requirements.InvalidRequirement:
                    # `packaging` only parses "new-style" git reqs: PEP 508
                    valid_requirement = False
                else:
                    valid_requirement = not bool(req.url)

                if not valid_requirement:
                    raise SystemExit(
                        f"You cannot use dependencies that are not on PyPI directly.\n"
                        f"See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references\n\n"
                        f"{reqs_file.name}:{lineno}: {line}"
                    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
