from collections.abc import Mapping
from datetime import datetime
from urllib.parse import urlencode, urlparse

from sentry.shared_integrations.response.base import BaseApiResponse

API_VERSION = "/api/v4"


class GitLabRateLimitInfo:
    def __init__(self, info: Mapping[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]
        self.used = info["used"]

    def next_window(self) -> str:
        return datetime.fromtimestamp(self.reset).strftime("%H:%M:%S")

    def __repr__(self) -> str:
        return f"GitLabRateLimitInfo(limit={self.limit},rem={self.remaining},reset={self.reset}),used={self.used})"


class GitLabApiClientPath:
    oauth_token = "/oauth/token"
    blame = "/projects/{project}/repository/files/{path}/blame"
    commit = "/projects/{project}/repository/commits/{sha}"
    commits = "/projects/{project}/repository/commits"
    commit_merge_requests = "/projects/{project}/repository/commits/{sha}/merge_requests"
    compare = "/projects/{project}/repository/compare"
    diff = "/projects/{project}/repository/commits/{sha}/diff"
    file = "/projects/{project}/repository/files/{path}"
    file_raw = "/projects/{project}/repository/files/{path}/raw"
    group = "/groups/{group}"
    group_projects = "/groups/{group}/projects"
    hooks = "/hooks"
    issue = "/projects/{project}/issues/{issue}"
    issues = "/projects/{project}/issues"
    create_issue_note = "/projects/{project}/issues/{issue_id}/notes"
    update_issue_note = "/projects/{project}/issues/{issue_id}/notes/{note_id}"
    create_pr_note = "/projects/{project}/merge_requests/{pr_key}/notes"
    update_pr_note = "/projects/{project}/merge_requests/{pr_key}/notes/{note_id}"
    pr_diffs = "/projects/{project}/merge_requests/{pr_key}/diffs"
    project = "/projects/{project}"
    project_issues = "/projects/{project}/issues"
    project_hooks = "/projects/{project}/hooks"
    project_hook = "/projects/{project}/hooks/{hook_id}"
    projects = "/projects"
    statuses = "/projects/{project}/statuses/{sha}"
    commit_statuses = "/projects/{project}/repository/commits/{sha}/statuses"
    user = "/user"

    @staticmethod
    def build_api_url(base_url, path) -> str:
        return f"{base_url.rstrip('/')}{API_VERSION}{path}"

    @classmethod
    def build_pr_diffs(cls, project: str, pr_key: str, unidiff: bool = False) -> str:
        params = {}
        if unidiff:
            params["unidiff"] = "true"

        return f"{cls.pr_diffs.format(project=project, pr_key=pr_key)}?{urlencode(params)}"


def get_rate_limit_info_from_response(
    response: BaseApiResponse,
) -> GitLabRateLimitInfo | None:
    """
    Extract rate limit info from response headers
    See https://docs.gitlab.com/ee/administration/settings/user_and_ip_rate_limits.html#response-headers
    """
    if not response.headers:
        return None

    rate_limit_params = {
        "limit": response.headers.get("RateLimit-Limit"),
        "remaining": response.headers.get("RateLimit-Remaining"),
        "reset": response.headers.get("RateLimit-Reset"),
        "used": response.headers.get("RateLimit-Observed"),
    }

    if not all([value and value.isdigit() for value in rate_limit_params.values()]):
        return None

    return GitLabRateLimitInfo(
        dict({(k, int(v) if v else 0) for k, v in rate_limit_params.items()})
    )


def parse_gitlab_blob_url(repo_url: str, source_url: str) -> tuple[str, str]:
    """
    Parse a GitLab blob URL relative to a repository URL and return
    a tuple of (branch, source_path). If parsing fails, returns ("", "").
    """
    repo_path = urlparse(repo_url).path.rstrip("/")
    path = urlparse(source_url).path
    if repo_path and path.startswith(repo_path):
        path = path[len(repo_path) :]

    if "/-/blob/" in path:
        _, _, after_blob = path.partition("/-/blob/")
    else:
        _, _, after_blob = path.partition("/blob/")

    if not after_blob:
        return "", ""

    branch, _, remainder = after_blob.partition("/")
    return branch, remainder.lstrip("/")
