from collections.abc import Sequence

SLASH = "/"
JAVA_SOURCE_ROOT_MARKERS = ("src/main/java/", "src/main/kotlin/")


def get_java_source_set_root(source_path: str) -> str | None:
    """Return the repo path through the Java/Kotlin source-set marker.

    Example:
    `module/src/main/java/io/sentry/Foo.java` -> `module/src/main/java/`
    """
    for marker in JAVA_SOURCE_ROOT_MARKERS:
        prefix, separator, _ = source_path.partition(marker)
        if separator:
            return f"{prefix}{separator}"

    return None


def find_package_root_relative_to_source_set(
    source_root: str, repo_files: Sequence[str]
) -> str | None:
    """Walk a source set until the directory tree stops being a single-child chain.

    Examples:
    `["module/src/main/java/io/sentry/graphql/Foo.java"]` with
    `source_root="module/src/main/java/"` returns `io/sentry/graphql/`.

    `["module/src/main/java/io/sentry/asyncprofiler/jfr/JfrParser.java",
    "module/src/main/java/io/sentry/asyncprofiler/metrics/ProfileMetric.java"]`
    with `source_root="module/src/main/java/"` returns `io/sentry/asyncprofiler/`.
    """
    relative_paths = [
        file.removeprefix(source_root) for file in repo_files if file.startswith(source_root)
    ]
    if not relative_paths:
        return None

    package_root = ""
    while True:
        has_file = False
        subdirs: set[str] = set()

        for relative_path in relative_paths:
            if package_root:
                if not relative_path.startswith(package_root):
                    continue
                remainder = relative_path[len(package_root) :]
            else:
                remainder = relative_path

            if not remainder:
                continue

            if SLASH not in remainder:
                has_file = True
                break

            subdirs.add(remainder.split(SLASH, 1)[0])
            if len(subdirs) > 1:
                break

        if has_file or len(subdirs) != 1:
            return package_root

        package_root = f"{package_root}{subdirs.pop()}{SLASH}"


def find_java_source_roots(
    source_path: str, repo_files: Sequence[str] | None
) -> tuple[str, str] | None:
    """Return `(stack_root, source_root)` from a Java/Kotlin repo path.

    Example:
    `sentry-graphql-core/src/main/java/io/sentry/graphql/GraphQLFetcher.java`
    becomes
    `("io/sentry/graphql/", "sentry-graphql-core/src/main/java/io/sentry/graphql/")`.
    """
    if not repo_files:
        return None

    if not (source_root := get_java_source_set_root(source_path)):
        return None

    if (package_root := find_package_root_relative_to_source_set(source_root, repo_files)) is None:
        return None

    return package_root, f"{source_root}{package_root}"
