from datetime import datetime
from typing import Mapping, Optional

from sentry.shared_integrations.response.base import BaseApiResponse

API_VERSION = "/api/v4"


class GitLabRateLimitInfo:
    def __init__(self, info: Mapping[str, int]) -> None:
        self.limit = info["limit"]
        self.remaining = info["remaining"]
        self.reset = info["reset"]
        self.used = info["used"]

    def next_window(self) -> str:
        return datetime.utcfromtimestamp(self.reset).strftime("%H:%M:%S")

    def __repr__(self) -> str:
        return f"GitLabRateLimitInfo(limit={self.limit},rem={self.remaining},reset={self.reset}),used={self.used})"


class GitLabApiClientPath:
    oauth_token = "/oauth/token"
    blame = "/projects/{project}/repository/files/{path}/blame"
    commit = "/projects/{project}/repository/commits/{sha}"
    commits = "/projects/{project}/repository/commits"
    compare = "/projects/{project}/repository/compare"
    diff = "/projects/{project}/repository/commits/{sha}/diff"
    file = "/projects/{project}/repository/files/{path}"
    group = "/groups/{group}"
    group_projects = "/groups/{group}/projects"
    hooks = "/hooks"
    issue = "/projects/{project}/issues/{issue}"
    issues = "/projects/{project}/issues"
    notes = "/projects/{project}/issues/{issue_id}/notes"
    project = "/projects/{project}"
    project_issues = "/projects/{project}/issues"
    project_hooks = "/projects/{project}/hooks"
    project_hook = "/projects/{project}/hooks/{hook_id}"
    project_search = "/projects/{project}/search"
    projects = "/projects"
    user = "/user"

    @staticmethod
    def build_api_url(base_url, path):
        return f"{base_url.rstrip('/')}{API_VERSION}{path}"


def get_rate_limit_info_from_response(
    response: BaseApiResponse,
) -> Optional[GitLabRateLimitInfo]:
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
