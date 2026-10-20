import pytest

from sentry.integrations.source_code_management.url import url_is_under


@pytest.mark.parametrize(
    ("url", "base", "expected"),
    [
        pytest.param("https://host/acme/repo/a.py", "https://host/acme", True, id="below"),
        pytest.param(
            "https://host/acme/repo/a.py", "https://host/acme/", True, id="trailing-slash"
        ),
        pytest.param("https://host/acme/repo/a.py", "https://host", True, id="host-only"),
        pytest.param("https://host/acme/repo/a.py", "https://host/", True, id="host-root"),
        pytest.param("http://host/acme/repo/a.py", "https://host/acme", True, id="other-scheme"),
        pytest.param("https://host/acme/repo/a.py?at=main", "https://host/acme", True, id="query"),
        pytest.param("https://host/acme-mobile/a.py", "https://host/acme", False, id="name-prefix"),
        pytest.param("https://host/other/a.py", "https://host/acme", False, id="other-path"),
        pytest.param("https://host/acme", "https://host/acme", False, id="base-itself"),
        pytest.param("https://host.evil/acme/a.py", "https://host/acme", False, id="host-prefix"),
        pytest.param("https://host:8443/acme/a.py", "https://host/acme", False, id="other-port"),
        pytest.param("https://host/acme/a.py", "https://other/acme", False, id="other-host"),
        pytest.param("not a url", "https://host", False, id="not-a-url"),
        pytest.param("host/acme/a.py", "host/acme", False, id="base-without-host"),
    ],
)
def test_url_is_under(url: str, base: str, expected: bool) -> None:
    assert url_is_under(url, base) is expected
