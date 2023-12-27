import pytest

from sentry.interfaces.security import Csp


@pytest.mark.parametrize(
    ("s", "expected"),
    (
        pytest.param("", "'self'", id="empty string is equivalent to self"),
        pytest.param("self", "'self'", id="unquoted self is equivalent to self"),
        pytest.param("'self'", "'self'", id="self is preserved"),
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
    assert Csp(blocked_uri=s).normalized_blocked_uri == expected
