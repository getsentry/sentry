"""Shared types for GitHub webhook handlers."""

from __future__ import annotations

from .check_run import GitHubCheckRunAction
from .issue_comment import GitHubIssueCommentAction
from .pull_request import PullRequestAction

# Union type of all valid GitHub webhook actions for code review
GithubWebhookAction = PullRequestAction | GitHubCheckRunAction | GitHubIssueCommentAction
