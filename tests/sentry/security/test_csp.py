import pytest

from sentry.security import csp


@pytest.mark.parametrize(
    ("s", "expected"),
    (
        pytest.param("", csp.LOCAL, id="empty string is equivalent to self"),
        pytest.param("self", csp.LOCAL, id="unquoted self is equivalent to self"),
        pytest.param("'self'", csp.LOCAL, id="self is preserved"),
        pytest.param("http", "http://", id="just http scheme"),
        pytest.param("https", "https://", id="just https scheme"),
        pytest.param("ftp://example.com/path", "ftp://example.com", id="keeps non-http schemes"),
        pytest.param("https://example.com/path", "example.com", id="removes https"),
        pytest.param("http://example.com/path", "example.com", id="removes http"),
        pytest.param("https://[not-a-url/path", "[not-a-url", id="invalid url"),
        pytest.param("https://[ip]:45678/path", "[ip]:45678", id="invalid url in 3.11+"),
    ),
)
def test_csp_url_normalization(s: str, expected: str) -> None:
    assert csp.normalize_value(s) == expected
