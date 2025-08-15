from enum import Enum


class GithubAPIErrorType(Enum):
    RATE_LIMITED = "gh_rate_limited"
    MISSING_PULL_REQUEST = "missing_gh_pull_request"
    UNKNOWN = "unknown_api_error"
