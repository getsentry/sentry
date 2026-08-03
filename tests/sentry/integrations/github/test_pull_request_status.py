from __future__ import annotations

from typing import Any

import pytest

from sentry.integrations.github.pull_request_status import (
    PULL_REQUEST_STATUS_FRAGMENT,
    create_pull_request_status_query,
    extract_pull_request_status_from_response,
    extract_pull_request_statuses_from_response,
)
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)


def response(rollup: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "data": {
            "repository": {
                "pullRequest": {"commits": {"nodes": [{"commit": {"statusCheckRollup": rollup}}]}}
            }
        }
    }


def test_create_pull_request_status_query() -> None:
    query = create_pull_request_status_query(
        [
            PullRequestStatusRequest(repo="getsentry/sentry", pull_number="42"),
            PullRequestStatusRequest(repo="getsentry/snuba", pull_number="7"),
        ]
    )

    assert query["variables"] == {
        "owner0": "getsentry",
        "name0": "sentry",
        "number0": 42,
        "owner1": "getsentry",
        "name1": "snuba",
        "number1": 7,
    }
    assert "repository0: repository(owner: $owner0, name: $name0)" in query["query"]
    assert "repository1: repository(owner: $owner1, name: $name1)" in query["query"]
    assert query["query"].count("...PullRequestStatusFields") == 2


def test_create_pull_request_status_query_requires_a_pull_request() -> None:
    with pytest.raises(ValueError, match="At least one pull request"):
        create_pull_request_status_query([])


def test_query_reads_the_head_commit() -> None:
    # Checks belong to the newest commit; reading any other one reports stale CI forever.
    assert "commits(last: 1)" in PULL_REQUEST_STATUS_FRAGMENT


def test_extract_pull_request_statuses() -> None:
    first = PullRequestStatusRequest(repo="getsentry/sentry", pull_number="42")
    second = PullRequestStatusRequest(repo="getsentry/snuba", pull_number="7")
    batch_response = {
        "data": {
            "repository0": response({"state": "SUCCESS"})["data"]["repository"],
            "repository1": response({"state": "FAILURE"})["data"]["repository"],
        }
    }

    assert extract_pull_request_statuses_from_response(batch_response, [first, second]) == {
        first: PullRequestStatusResult(checks=AggregateChecksStatus.SUCCESS),
        second: PullRequestStatusResult(checks=AggregateChecksStatus.FAILURE),
    }


@pytest.mark.parametrize(
    ("state", "expected"),
    (
        ("SUCCESS", AggregateChecksStatus.SUCCESS),
        ("FAILURE", AggregateChecksStatus.FAILURE),
        ("PENDING", AggregateChecksStatus.PENDING),
        # ERROR and EXPECTED have no member of their own.
        ("ERROR", AggregateChecksStatus.FAILURE),
        ("EXPECTED", AggregateChecksStatus.PENDING),
        # A state GitHub adds later.
        ("SOMETHING_NEW", None),
    ),
)
def test_extract_checks(state: str, expected: AggregateChecksStatus | None) -> None:
    assert extract_pull_request_status_from_response(response({"state": state})).checks == expected


def test_extract_without_ci() -> None:
    # No CI is an absent state, not a pending one.
    assert extract_pull_request_status_from_response(response()) == PullRequestStatusResult()


@pytest.mark.parametrize(
    "data",
    (
        {"repository": {"pullRequest": {"commits": {"nodes": []}}}},
        {"repository": {"pullRequest": None}},
        {"repository": None},
        None,
    ),
    ids=("no_commits", "no_pull_request", "no_repository", "no_data"),
)
def test_extract_nullable_levels(data: dict[str, Any] | None) -> None:
    # An inaccessible repository or a deleted pull request nulls a level of the
    # response rather than erroring.
    assert extract_pull_request_status_from_response({"data": data}) == PullRequestStatusResult()
