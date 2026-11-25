from collections.abc import Iterator
from typing import TypedDict
from unittest.mock import MagicMock, patch

import orjson
import pytest
from urllib3 import Timeout

from sentry.feedback.lib import seer_api
from sentry.feedback.tasks.spam_shadow import spam_shadow_score
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)
from tests.sentry.feedback import MockSeerResponse


class _TaskKwargs(TypedDict):
    organization_id: int
    project_id: int
    feedback_event_id: str
    feedback_message: str
    llm_is_spam: bool


TASK_KWARGS: _TaskKwargs = {
    "organization_id": 1,
    "project_id": 2,
    "feedback_event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
    "feedback_message": "Buy cheap watches now",
    "llm_is_spam": True,
}

SCORED_RESPONSE = {
    "skipped": False,
    "score": 0.97,
    "classifier_is_spam": True,
    "mismatch": False,
    "model_version": "v1",
}


@pytest.fixture
def mock_request() -> Iterator[MagicMock]:
    with patch(
        "sentry.feedback.tasks.spam_shadow.make_spam_shadow_score_request",
        return_value=MockSeerResponse(200, SCORED_RESPONSE),
    ) as mck:
        yield mck


@pytest.fixture
def mock_metrics() -> Iterator[MagicMock]:
    with patch("sentry.feedback.tasks.spam_shadow.metrics") as mck:
        yield mck


@django_db_all
def test_posts_body_to_spam_score_path() -> None:
    with patch(
        "sentry.feedback.lib.seer_api.make_signed_seer_api_request",
        return_value=MockSeerResponse(200, SCORED_RESPONSE),
    ) as mock_signed:
        spam_shadow_score(**TASK_KWARGS)

    assert mock_signed.call_count == 1
    pool, path = mock_signed.call_args.args
    assert pool is seer_api.seer_summarization_connection_pool
    assert path == "/v0/feedback/spam-score"
    assert orjson.loads(mock_signed.call_args.kwargs["body"]) == {
        **TASK_KWARGS,
        "log_mismatch_message": False,
    }
    assert mock_signed.call_args.kwargs["retries"] == 0
    # A total timeout, which ends before the task deadline.
    timeout = mock_signed.call_args.kwargs["timeout"]
    assert isinstance(timeout, Timeout)
    assert timeout.total == 15
    assert "viewer_context" not in mock_signed.call_args.kwargs


@django_db_all
def test_uses_propagated_viewer_context(mock_request: MagicMock) -> None:
    captured = {}

    def capture(*args: object, **kwargs: object) -> MockSeerResponse:
        captured["vc"] = get_viewer_context()
        return MockSeerResponse(200, SCORED_RESPONSE)

    mock_request.side_effect = capture
    propagated = ViewerContext(actor=Actor(type=ActorType.SYSTEM), organization_id=1, project_id=2)
    with viewer_context_scope(propagated):
        spam_shadow_score(**TASK_KWARGS)

    assert captured["vc"] is propagated


@django_db_all
@pytest.mark.parametrize(
    ("log_org_ids", "expected"),
    [
        ([], False),
        ([999], False),
        ([1], True),
        ([999, 1], True),
    ],
)
def test_log_mismatch_message_only_for_allowlisted_orgs(
    mock_request: MagicMock, log_org_ids: list[int], expected: bool
) -> None:
    with override_options({"feedback.spam-shadow.message-log-org-ids": log_org_ids}):
        spam_shadow_score(**TASK_KWARGS)

    body = mock_request.call_args.args[0]
    assert body["log_mismatch_message"] is expected


@django_db_all
def test_records_scored_metric(mock_request: MagicMock, mock_metrics: MagicMock) -> None:
    spam_shadow_score(**TASK_KWARGS)
    mock_metrics.incr.assert_called_once_with(
        "feedback.spam_shadow.scored", tags={"skipped": False}
    )


@django_db_all
def test_records_skipped_metric(mock_request: MagicMock, mock_metrics: MagicMock) -> None:
    mock_request.return_value = MockSeerResponse(
        200,
        {
            "skipped": True,
            "score": None,
            "classifier_is_spam": None,
            "mismatch": None,
            "model_version": None,
        },
    )
    spam_shadow_score(**TASK_KWARGS)
    mock_metrics.incr.assert_called_once_with("feedback.spam_shadow.scored", tags={"skipped": True})


@django_db_all
def test_swallows_request_exception(mock_request: MagicMock, mock_metrics: MagicMock) -> None:
    mock_request.side_effect = Exception("connection refused")
    spam_shadow_score(**TASK_KWARGS)
    mock_metrics.incr.assert_called_once_with(
        "feedback.spam_shadow.error", tags={"reason": "request"}
    )


@django_db_all
@pytest.mark.parametrize("status", [400, 500, 503])
def test_swallows_non_2xx(mock_request: MagicMock, mock_metrics: MagicMock, status: int) -> None:
    mock_request.return_value = MockSeerResponse(status, {"detail": "error"})
    spam_shadow_score(**TASK_KWARGS)
    mock_metrics.incr.assert_called_once_with(
        "feedback.spam_shadow.error", tags={"reason": "status", "status": str(status)}
    )


@django_db_all
def test_swallows_invalid_json(mock_request: MagicMock, mock_metrics: MagicMock) -> None:
    response = MagicMock(status=200)
    response.json.side_effect = ValueError("not json")
    mock_request.return_value = response
    spam_shadow_score(**TASK_KWARGS)
    mock_metrics.incr.assert_called_once_with(
        "feedback.spam_shadow.error", tags={"reason": "invalid_response"}
    )
