from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    PullRequestFileSummary,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.utils.safe import get_path

PULL_REQUEST_STATUS_FRAGMENT = """
fragment PullRequestStatusFields on PullRequest {
  reviewDecision
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          state
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun {
                name
                conclusion
              }
              ... on StatusContext {
                context
                state
              }
            }
          }
        }
      }
    }
  }
}
"""

PULL_REQUEST_FILES_FRAGMENT = """
fragment PullRequestFilesFields on PullRequest {
  files(first: 100) {
    nodes {
      path
      additions
      deletions
      changeType
    }
  }
}
"""

_CHECKS_STATUS_BY_STATE: dict[str, AggregateChecksStatus] = {
    "SUCCESS": AggregateChecksStatus.SUCCESS,
    "FAILURE": AggregateChecksStatus.FAILURE,
    "ERROR": AggregateChecksStatus.FAILURE,
    "PENDING": AggregateChecksStatus.PENDING,
    "EXPECTED": AggregateChecksStatus.PENDING,
}

# CANCELLED is deliberately absent: like the rollup mapping above, it is neither pass nor fail.
_FAILING_CHECK_RUN_CONCLUSIONS = frozenset(
    ("FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED")
)
_FAILING_STATUS_CONTEXT_STATES = frozenset(("FAILURE", "ERROR"))

_REVIEW_STATUS_BY_DECISION: dict[str, AggregateReviewStatus] = {
    "APPROVED": AggregateReviewStatus.APPROVED,
    "CHANGES_REQUESTED": AggregateReviewStatus.CHANGES_REQUESTED,
    "REVIEW_REQUIRED": AggregateReviewStatus.REVIEW_REQUIRED,
}


def create_pull_request_status_query(
    pull_requests: Sequence[PullRequestStatusRequest],
) -> dict[str, Any]:
    """Create one GraphQL query for several pull requests."""
    if not pull_requests:
        raise ValueError("At least one pull request is required")

    variable_definitions: list[str] = []
    repository_queries: list[str] = []
    variables: dict[str, str | int] = {}

    for index, pull_request in enumerate(pull_requests):
        owner, separator, name = pull_request.repo.partition("/")
        if not separator or not owner or not name:
            raise ValueError(f"Invalid GitHub repository name: {pull_request.repo!r}")

        variable_definitions.extend(
            (
                f"$owner{index}: String!",
                f"$name{index}: String!",
                f"$number{index}: Int!",
            )
        )
        variables.update(
            {
                f"owner{index}": owner,
                f"name{index}": name,
                f"number{index}": int(pull_request.pull_number),
            }
        )
        fragment_spreads = ["...PullRequestStatusFields"]
        if pull_request.include_files:
            fragment_spreads.append("...PullRequestFilesFields")
        selection = "\n      ".join(fragment_spreads)
        repository_queries.append(
            f"""  repository{index}: repository(owner: $owner{index}, name: $name{index}) {{
    pullRequest(number: $number{index}) {{
      {selection}
    }}
  }}"""
        )

    repository_query = "\n".join(repository_queries)
    fragments = PULL_REQUEST_STATUS_FRAGMENT
    if any(pull_request.include_files for pull_request in pull_requests):
        fragments += PULL_REQUEST_FILES_FRAGMENT
    query = (
        f"query pullRequestStatuses({', '.join(variable_definitions)}) {{\n"
        f"{repository_query}\n"
        f"}}\n{fragments}"
    )
    return {"query": query, "variables": variables}


def _extract_files(pull_request: Any) -> tuple[PullRequestFileSummary, ...]:
    nodes = get_path(pull_request, "files", "nodes") or []
    files: list[PullRequestFileSummary] = []
    for node in nodes:
        if not isinstance(node, Mapping):
            continue
        path = node.get("path")
        additions = node.get("additions")
        deletions = node.get("deletions")
        change_type = node.get("changeType")
        if not (
            isinstance(path, str)
            and isinstance(additions, int)
            and isinstance(deletions, int)
            and isinstance(change_type, str)
        ):
            continue
        files.append(
            PullRequestFileSummary(
                path=path,
                additions=additions,
                deletions=deletions,
                change_type=change_type,
            )
        )
    return tuple(files)


def _extract_failed_checks(pull_request: Any) -> tuple[str, ...]:
    nodes = (
        get_path(
            pull_request,
            "commits",
            "nodes",
            0,
            "commit",
            "statusCheckRollup",
            "contexts",
            "nodes",
        )
        or []
    )
    failed: list[str] = []
    for node in nodes:
        if not isinstance(node, Mapping):
            continue
        if node.get("__typename") == "CheckRun":
            name = node.get("name")
            failing = node.get("conclusion") in _FAILING_CHECK_RUN_CONCLUSIONS
        elif node.get("__typename") == "StatusContext":
            name = node.get("context")
            failing = node.get("state") in _FAILING_STATUS_CONTEXT_STATES
        else:
            continue
        if failing and isinstance(name, str):
            failed.append(name)
    return tuple(failed)


def _extract_pull_request_status(pull_request: Any) -> PullRequestStatusResult:
    state = get_path(pull_request, "commits", "nodes", 0, "commit", "statusCheckRollup", "state")
    decision = get_path(pull_request, "reviewDecision")
    return PullRequestStatusResult(
        checks=_CHECKS_STATUS_BY_STATE.get(state),
        review=_REVIEW_STATUS_BY_DECISION.get(decision),
        files=_extract_files(pull_request),
        failed_checks=_extract_failed_checks(pull_request),
    )


def extract_pull_request_status_from_response(response: Any) -> PullRequestStatusResult:
    """
    Read checks and review state from the legacy single-repository response shape.

    Every level of the response is nullable and unrecognized values map to no state, so
    a repository without CI, or a value GitHub adds later, reports nothing rather than
    something wrong.
    """
    return _extract_pull_request_status(get_path(response, "data", "repository", "pullRequest"))


def extract_pull_request_statuses_from_response(
    response: Any, pull_requests: Sequence[PullRequestStatusRequest]
) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
    return {
        pull_request: _extract_pull_request_status(
            get_path(response, "data", f"repository{index}", "pullRequest")
        )
        for index, pull_request in enumerate(pull_requests)
    }
