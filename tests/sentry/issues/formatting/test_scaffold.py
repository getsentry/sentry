from sentry import options


def test_package_imports() -> None:
    import sentry.issues.formatting  # noqa: F401


def test_option_registered() -> None:
    # registered with a default of False until a consumer opts in
    # lookup_key checks the in-memory registry (no DB); raises UnknownOption if missing
    key = options.lookup_key("issues.standardized-markdown-for-llm")
    assert key.default() is False
