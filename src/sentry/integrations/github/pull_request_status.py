from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.utils.safe import get_path

PULL_REQUEST_STATUS_FRAGMENT = """
fragment PullRequestStatusFields on PullRequest {
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          state
        }
      }
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
        repository_queries.append(
            f"""  repository{index}: repository(owner: $owner{index}, name: $name{index}) {{
    pullRequest(number: $number{index}) {{
      ...PullRequestStatusFields
    }}
  }}"""
        )

    repository_query = "\n".join(repository_queries)
    query = (
        f"query pullRequestStatuses({', '.join(variable_definitions)}) {{\n"
        f"{repository_query}\n"
        f"}}\n{PULL_REQUEST_STATUS_FRAGMENT}"
    )
    return {"query": query, "variables": variables}


def _extract_pull_request_status(pull_request: Any) -> PullRequestStatusResult:
    state = get_path(pull_request, "commits", "nodes", 0, "commit", "statusCheckRollup", "state")
    return PullRequestStatusResult(checks=_CHECKS_STATUS_BY_STATE.get(state))


def extract_pull_request_status_from_response(response: Any) -> PullRequestStatusResult:
    """
    Read checks state from the legacy single-repository response shape.

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
