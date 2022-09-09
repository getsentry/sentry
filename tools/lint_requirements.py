import packaging.requirements


def main() -> None:
    """
    We cannot have non-specifier requirements if we want to publish to PyPI
    due to security concerns. This check ensures we don't have/add any URL/VCS
    dependencies in the base requirements file.
    """
    with open("requirements-frozen.txt") as reqs_file:
        for lineno, line in enumerate(reqs_file, start=1):
            line = line.strip()
            if not line or line.startswith(("--", "#")):
                continue

            try:
                packaging.requirements.Requirement(line)
            except packaging.requirements.InvalidRequirement:
                raise SystemExit(
                    f"You cannot use dependencies that are not on PyPI directly.\n"
                    f"See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references\n\n"
                    f"{reqs_file.name}:{lineno}: {line}"
                )


if __name__ == "__main__":
    main()
