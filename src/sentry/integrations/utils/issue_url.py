from urllib.parse import ParseResult, unquote, urlparse

from sentry.shared_integrations.exceptions import IntegrationFormError

_DEFAULT_PORTS = {"http": 80, "https": 443}


def get_url_origin(url: ParseResult) -> tuple[str, str, int] | None:
    """Scheme, host and port, with the port defaulted so ``:443`` == implicit."""
    if url.scheme not in _DEFAULT_PORTS or not url.hostname:
        return None
    try:
        port = url.port
    except ValueError:  # a non-numeric port
        return None
    return (url.scheme, url.hostname.lower(), port or _DEFAULT_PORTS[url.scheme])


def parse_issue_url(url: str) -> ParseResult:
    """Parse a tracker URL without allowing credentials or ambiguous path segments."""
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        raise IntegrationFormError({"externalIssue": "Invalid issue URL"}) from None
    if get_url_origin(parsed) is None or parsed.username is not None or parsed.password is not None:
        raise IntegrationFormError({"externalIssue": "Invalid issue URL"})
    path = unquote(parsed.path).rstrip("/")
    if (path and any(segment in ("", ".", "..") for segment in path[1:].split("/"))) or any(
        character in path for character in ("\\", "#", "?")
    ):
        raise IntegrationFormError({"externalIssue": "Invalid issue URL"})
    return parsed._replace(path=path)


def get_issue_url_path(url: str, base_url: str) -> str:
    """Return the issue path relative to the selected installation's web URL."""
    parsed = parse_issue_url(url)
    base = parse_issue_url(base_url)
    if get_url_origin(parsed) != get_url_origin(base) or not parsed.path.startswith(
        f"{base.path}/"
    ):
        raise IntegrationFormError(
            {"externalIssue": "Issue URL does not belong to this installation"}
        )
    return parsed.path[len(base.path) :]
