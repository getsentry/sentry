"""
Pull request functionality for preprod integration.

This module provides normalized data models and adapters for working with
pull request data across different SCM providers (GitHub, GitLab, Bitbucket).
"""

from sentry.preprod.pull_request.adapters import PullRequestDataAdapter
from sentry.preprod.pull_request.types import (
    PullRequestDetails,
    PullRequestFileChange,
    PullRequestWithFiles,
)

__all__ = [
    "PullRequestDetails",
    "PullRequestFileChange",
    "PullRequestWithFiles",
    "PullRequestDataAdapter",
]
