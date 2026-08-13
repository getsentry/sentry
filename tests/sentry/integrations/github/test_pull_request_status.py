from __future__ import annotations

from typing import Any

import pytest

from sentry.integrations.github.pull_request_status import (
    PULL_REQUEST_FILES_FRAGMENT,
    PULL_REQUEST_STATUS_FRAGMENT,
    create_pull_request_status_query,
    extract_pull_request_status_from_response,
    extract_pull_request_statuses_from_response,
)
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    PullRequestFileSummary,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)


def response(
    rollup: dict[str, Any] | None = None,
    review_decision: str | None = None,
    files: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "data": {
            "repository": {
                "pullRequest": {
                    "reviewDecision": review_decision,
                    "commits": {"nodes": [{"commit": {"statusCheckRollup": rollup}}]},
                    "files": files,
                }
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
    assert PULL_REQUEST_FILES_FRAGMENT not in query["query"]


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
            "repository0": response({"state": "SUCCESS"}, review_decision="APPROVED")["data"][
                "repository"
            ],
            "repository1": response({"state": "FAILURE"}, review_decision="CHANGES_REQUESTED")[
                "data"
            ]["repository"],
        }
    }

    assert extract_pull_request_statuses_from_response(batch_response, [first, second]) == {
        first: PullRequestStatusResult(
            checks=AggregateChecksStatus.SUCCESS,
            review=AggregateReviewStatus.APPROVED,
        ),
        second: PullRequestStatusResult(
            checks=AggregateChecksStatus.FAILURE,
            review=AggregateReviewStatus.CHANGES_REQUESTED,
        ),
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


@pytest.mark.parametrize(
    ("decision", "expected"),
    (
        ("APPROVED", AggregateReviewStatus.APPROVED),
        ("CHANGES_REQUESTED", AggregateReviewStatus.CHANGES_REQUESTED),
        ("REVIEW_REQUIRED", AggregateReviewStatus.REVIEW_REQUIRED),
        ("SOMETHING_NEW", None),
    ),
)
def test_extract_review(decision: str, expected: AggregateReviewStatus | None) -> None:
    result = extract_pull_request_status_from_response(response(review_decision=decision))
    assert result.review == expected


def test_extract_reads_checks_and_review_from_one_response() -> None:
    # Failing checks alongside an approving review: neither field masks the other.
    assert extract_pull_request_status_from_response(
        response({"state": "FAILURE"}, review_decision="APPROVED")
    ) == PullRequestStatusResult(
        checks=AggregateChecksStatus.FAILURE, review=AggregateReviewStatus.APPROVED
    )


def test_extract_without_ci_or_required_review() -> None:
    # No CI and no required review are absent states, not pending ones.
    assert extract_pull_request_status_from_response(response()) == PullRequestStatusResult()


def test_query_reads_changed_files_when_requested() -> None:
    query = create_pull_request_status_query(
        [PullRequestStatusRequest(repo="getsentry/sentry", pull_number="42", include_files=True)]
    )

    assert "...PullRequestFilesFields" in query["query"]
    assert PULL_REQUEST_FILES_FRAGMENT in query["query"]


def test_extract_files() -> None:
    result = extract_pull_request_status_from_response(
        response(
            files={
                "nodes": [
                    {
                        "path": "src/sentry/foo.py",
                        "additions": 10,
                        "deletions": 2,
                        "changeType": "MODIFIED",
                    },
                    {
                        "path": "src/sentry/bar.py",
                        "additions": 3,
                        "deletions": 0,
                        "changeType": "ADDED",
                    },
                ]
            }
        )
    )

    assert result.files == (
        PullRequestFileSummary(
            path="src/sentry/foo.py", additions=10, deletions=2, change_type="MODIFIED"
        ),
        PullRequestFileSummary(
            path="src/sentry/bar.py", additions=3, deletions=0, change_type="ADDED"
        ),
    )


@pytest.mark.parametrize(
    "files",
    (None, {"nodes": None}, {"nodes": []}),
    ids=("no_files", "no_nodes", "empty_nodes"),
)
def test_extract_files_without_nodes(files: dict[str, Any] | None) -> None:
    assert extract_pull_request_status_from_response(response(files=files)).files == ()


def test_extract_files_skips_partial_nodes() -> None:
    result = extract_pull_request_status_from_response(
        response(
            files={
                "nodes": [
                    None,
                    {"path": "missing-counts.py"},
                    {
                        "path": "src/sentry/valid.py",
                        "additions": 2,
                        "deletions": 1,
                        "changeType": "MODIFIED",
                    },
                ]
            }
        )
    )

    assert result.files == (
        PullRequestFileSummary(
            path="src/sentry/valid.py", additions=2, deletions=1, change_type="MODIFIED"
        ),
    )


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
