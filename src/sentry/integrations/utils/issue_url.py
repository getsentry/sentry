from urllib.parse import ParseResult, unquote, urlparse

from sentry.shared_integrations.exceptions import IntegrationFormError


def parse_issue_url(url: str) -> ParseResult:
    """Parse a tracker URL without allowing credentials or ambiguous path segments."""
    try:
        parsed = urlparse(url.strip())
        _ = parsed.port
    except ValueError:
        raise IntegrationFormError({"externalIssue": "Invalid issue URL"}) from None
    if (
        parsed.scheme not in ("http", "https")
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
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
    default_port = 443 if parsed.scheme == "https" else 80
    if (
        parsed.scheme != base.scheme
        or parsed.hostname != base.hostname
        or (parsed.port or default_port) != (base.port or default_port)
        or not parsed.path.startswith(f"{base.path}/")
    ):
        raise IntegrationFormError(
            {"externalIssue": "Issue URL does not belong to this installation"}
        )
    return parsed.path[len(base.path) :]
