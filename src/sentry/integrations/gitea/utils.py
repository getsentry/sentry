from __future__ import annotations

import re
from collections.abc import Mapping
from urllib.parse import quote, urlparse

from sentry.shared_integrations.response.base import BaseApiResponse

API_VERSION = "/api/v1"

# The OAuth endpoints are served by Gitea itself rather than the API, so they
# hang off the base URL instead of `API_VERSION`.
OAUTH_ACCESS_TOKEN_PATH = "/login/oauth/access_token"
OAUTH_AUTHORIZE_PATH = "/login/oauth/authorize"

# Gitea's web UI routes a ref by kind rather than resolving it, so
# `/src/branch/<sha>` 404s where `/src/commit/<sha>` works.
SOURCE_URL_REF_TYPES = ("branch", "commit", "tag")

# Gitea abbreviates SHAs freely and supports SHA-256 repositories, and a release
# commit reaches us as an unvalidated string, so the bound is deliberately loose.
# A branch named in nothing but lowercase hex would be misread as a commit; that
# is rarer than the abbreviated SHAs this exists to catch.
_COMMIT_SHA = re.compile(r"\A[0-9a-f]{7,64}\Z", re.IGNORECASE)

# `owner/name`, the only shape a Gitea repository route accepts.
_REPO_PATH = re.compile(r"\A[^/\s]+/[^/\s]+\Z")


def build_api_url(base_url: str, path: str) -> str:
    """
    Gitea's ``ROOT_URL`` is free-form and may include a sub-path
    (``https://example.com/gitea/``), so every API URL is derived from the
    stored base URL rather than from a hostname.
    """
    return f"{base_url.rstrip('/')}{API_VERSION}{path}"


def has_relative_segments(path: str) -> bool:
    """
    Whether a path would climb out of the route it is interpolated into.

    Unlike GitLab, Gitea takes file paths as real path segments rather than one
    encoded component, so the separators have to survive. That means dot
    segments survive too, and ``requests`` resolves them before the request
    leaves us - a path of ``../../../../user`` against
    ``/repos/{owner}/{repo}/contents/`` would eat the repo scope entirely and
    hit ``/api/v1/user``.
    """
    return any(segment in (".", "..") for segment in path.lstrip("/").split("/"))


def quote_path(filepath: str) -> str:
    """
    Quote a file path for use in a URL path.

    Code-mapping source roots are user-editable, so a climbing path is reachable
    input rather than a theoretical one: refuse it. Callers that can be reached
    with a user-supplied path should screen it with ``has_relative_segments``
    first - by the time this raises, the surrounding SLO span has already been
    entered and would record the refusal as an integration failure.
    """
    if has_relative_segments(filepath):
        raise ValueError("Gitea file paths may not contain relative path segments")
    return quote(filepath.lstrip("/"), safe="/")


def is_repo_path(value: str) -> bool:
    """Whether a string is safe to interpolate into a ``/repos/{repo}`` route."""
    return bool(_REPO_PATH.match(value)) and not has_relative_segments(value)


def source_ref_segment(ref: str) -> str:
    """
    The ``/src/{kind}/{ref}/`` segment pair for a ref.

    Stacktrace linking hands us the event's release commit when it has one and
    the default branch otherwise, and Gitea will not resolve a SHA under
    ``/src/branch/``, so the kind has to be picked from the ref itself.
    """
    return f"commit/{ref}" if _COMMIT_SHA.match(ref) else f"branch/{ref}"


def parse_gitea_source_url(repo_url: str, source_url: str) -> tuple[str, str]:
    """
    Split a Gitea source URL into ``(ref, source_path)`` relative to a
    repository URL, or ``("", "")`` when it is not one.

    Gitea's file URLs are ``{repo}/src/{branch|commit|tag}/{ref}/{path}``,
    which is a segment longer than GitHub's ``/blob/{ref}/{path}``.
    """
    repo_path = urlparse(repo_url).path.rstrip("/")
    path = urlparse(source_url).path
    if repo_path and path.startswith(repo_path):
        path = path[len(repo_path) :]

    _, separator, after_src = path.partition("/src/")
    if not separator:
        return "", ""

    ref_type, _, remainder = after_src.partition("/")
    if ref_type not in SOURCE_URL_REF_TYPES:
        return "", ""

    ref, _, source_path = remainder.partition("/")
    return ref, source_path.lstrip("/")


class GiteaApiPath:
    """
    Paths relative to ``{base_url}/api/v1``.

    Everything here exists in Gitea 1.22, the oldest surface we support (and
    Forgejo's frozen compatibility baseline).
    """

    user = "/user"
    version = "/version"

    repo_search = "/repos/search"
    repo = "/repos/{repo}"
    # Used by the coding-agent handoff in getsentry, which downloads a repository as
    # a source archive and later commits the agent's patch back. `{ref}` is a
    # path-like ref (`main`, `release/1.x`) with the format appended, e.g.
    # `main.tar.gz`; Gitea routes the whole tail as a wildcard, so a ref containing
    # slashes is fine.
    archive = "/repos/{repo}/archive/{ref}"

    branches = "/repos/{repo}/branches"
    branch = "/repos/{repo}/branches/{branch}"

    commits = "/repos/{repo}/commits"
    commit = "/repos/{repo}/git/commits/{sha}"
    compare = "/repos/{repo}/compare/{basehead}"

    contents = "/repos/{repo}/contents/{path}"
    # Applies several file operations in one commit, and can cut the branch it
    # commits to at the same time (`new_branch`). Present since Gitea 1.20, so within
    # the 1.22 baseline above. Used by the coding-agent handoff in getsentry.
    contents_batch = "/repos/{repo}/contents"
    raw = "/repos/{repo}/raw/{path}"

    issues = "/repos/{repo}/issues"
    issue = "/repos/{repo}/issues/{issue_index}"
    issue_comments = "/repos/{repo}/issues/{issue_index}/comments"
    labels = "/repos/{repo}/labels"
    assignees = "/repos/{repo}/assignees"

    hooks = "/repos/{repo}/hooks"
    hook = "/repos/{repo}/hooks/{hook_id}"

    pulls = "/repos/{repo}/pulls"
    pull = "/repos/{repo}/pulls/{pull_index}"


class GiteaRateLimitInfo:
    def __init__(self, info: Mapping[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]

    def __repr__(self) -> str:
        return f"GiteaRateLimitInfo(limit={self.limit},rem={self.remaining},reset={self.reset})"


def get_rate_limit_info_from_response(
    response: BaseApiResponse,
) -> GiteaRateLimitInfo | None:
    """
    Stock Gitea has no rate limiting, but hosted instances (gitea.com included)
    sit behind proxies that emit the IETF ``RateLimit`` headers. Read them when
    they show up; never assume they do.
    """
    if not response.headers:
        return None

    rate_limit_params = {
        "limit": response.headers.get("RateLimit-Limit"),
        "remaining": response.headers.get("RateLimit-Remaining"),
        "reset": response.headers.get("RateLimit-Reset"),
    }

    if not all(value and value.isdigit() for value in rate_limit_params.values()):
        return None

    return GiteaRateLimitInfo({k: int(v) for k, v in rate_limit_params.items() if v})
