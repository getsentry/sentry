from sentry import options


def test_option_registered() -> None:
    # lookup_key checks the in-memory registry (no DB); raises UnknownOption if missing
    key = options.lookup_key("issues.standardized-markdown-for-llm")
    assert key.default() is False
