import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str | None
    url: str
    affected_users: int | None = None
    event_count: int | None = None
    function_name: str | None = None


@dataclass
class PullRequestFile:
    filename: str
    patch: str


class GithubAPIErrorType(Enum):
    RATE_LIMITED = "gh_rate_limited"
    MISSING_PULL_REQUEST = "missing_gh_pull_request"
    UNKNOWN = "unknown_api_error"
