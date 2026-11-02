from unittest.mock import MagicMock, Mock, patch

import pytest
from django.test import override_settings
from urllib3 import HTTPConnectionPool, HTTPResponse
from urllib3.exceptions import ReadTimeoutError

from sentry.seer.signed_seer_api import (
    MissingViewerContextError,
    SeerViewerContext,
    _resolve_viewer_context,
    make_delete_grouping_records_by_project_request,
    make_signed_seer_api_request,
)
from sentry.viewer_context import (
    Actor,
    ActorType,
    SuperuserAccess,
    ViewerContext,
    viewer_context_scope,
)

REQUEST_BODY = b'{"b": 12, "thing": "thing"}'
PATH = "/v0/some/url"
DYNAMIC_PATH = "/v0/issues/similar-issues/grouping-record/delete/123456"


def run_test_case(
    path: str = PATH,
    shared_secret: str = "secret-one",
    **kwargs,
):
    """
    Make a mock connection pool, call `make_signed_seer_api_request` on it, and return the
    pool's `urlopen` method, so we can make assertions on how `make_signed_seer_api_request`
    used it.
    """
    mock = Mock()
    mock.host = "localhost"
    mock.port = None
    mock.scheme = "http"
    mock.urlopen.return_value = HTTPResponse(status=200)
    context = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1), organization_id=1)
    with (
        override_settings(SEER_API_SHARED_SECRET=shared_secret),
        viewer_context_scope(context),
    ):
        make_signed_seer_api_request(mock, path=path, body=REQUEST_BODY, **kwargs)

    return mock.urlopen


@pytest.mark.django_db
def test_simple() -> None:
    mock_url_open = run_test_case()
    mock_url_open.assert_called_once()
    assert mock_url_open.call_args.args == ("POST", PATH)
    assert mock_url_open.call_args.kwargs["body"] == REQUEST_BODY
    headers = mock_url_open.call_args.kwargs["headers"]
    assert headers["content-type"] == "application/json;charset=utf-8"
    assert (
        headers["Authorization"]
        == "Rpcsignature rpc0:d2e6070dfab955db6fc9f3bc0518f75f27ca93ae2e393072929e5f6cba26ff07"
    )
    assert headers["X-Viewer-Context"]


@pytest.mark.django_db
def test_preserves_query_string() -> None:
    mock_url_open = run_test_case(path=f"{PATH}?foo=bar&baz=qux", method="GET")
    assert mock_url_open.call_args.args[1] == f"{PATH}?foo=bar&baz=qux"


@pytest.mark.django_db
def test_uses_given_timeout() -> None:
    mock_url_open = run_test_case(timeout=5)
    mock_url_open.assert_called_once()
    assert mock_url_open.call_args.kwargs["timeout"] == 5


@pytest.mark.django_db
def test_uses_given_retries() -> None:
    mock_url_open = run_test_case(retries=5)
    mock_url_open.assert_called_once()
    assert mock_url_open.call_args.kwargs["retries"] == 5


@pytest.mark.django_db
def test_missing_secret_does_not_send_request() -> None:
    pool = Mock(host="localhost", port=None, scheme="http")
    context = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1), organization_id=1)

    with (
        override_settings(SEER_API_SHARED_SECRET=""),
        viewer_context_scope(context),
        pytest.raises(ValueError, match="No signing key available"),
    ):
        make_signed_seer_api_request(pool, path=PATH, body=REQUEST_BODY)

    pool.urlopen.assert_not_called()


@patch("sentry.seer.signed_seer_api.encode_viewer_context", side_effect=RuntimeError("boom"))
def test_viewer_context_encoding_failure_does_not_send_request(
    mock_encode_viewer_context: MagicMock,
) -> None:
    pool = Mock(host="localhost", port=None, scheme="http")
    context = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1), organization_id=1)

    with viewer_context_scope(context), pytest.raises(RuntimeError, match="boom"):
        make_signed_seer_api_request(pool, path=PATH, body=REQUEST_BODY)

    mock_encode_viewer_context.assert_called_once_with(context)
    pool.urlopen.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("path", "endpoint"),
    [
        (PATH, PATH),
        (f"{PATH}?dogs=great", PATH),
        (DYNAMIC_PATH, DYNAMIC_PATH),
    ],
)
@patch("sentry.seer.signed_seer_api.metrics.timer")
def test_times_request(mock_metrics_timer: MagicMock, path: str, endpoint: str) -> None:
    run_test_case(path=path)
    mock_metrics_timer.assert_called_with(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": endpoint},
    )


@pytest.mark.django_db
@patch("sentry.seer.signed_seer_api._resolve_viewer_context")
def test_resolves_viewer_context_with_endpoint(mock_resolve: MagicMock) -> None:
    mock_resolve.return_value = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1))

    run_test_case(path=f"{DYNAMIC_PATH}?plan_tier=business")

    mock_resolve.assert_called_once_with(None, endpoint=DYNAMIC_PATH)


@pytest.mark.django_db
@patch("sentry.seer.signed_seer_api._resolve_viewer_context")
def test_resolves_viewer_context_with_metrics_endpoint(mock_resolve: MagicMock) -> None:
    mock_resolve.return_value = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1))

    run_test_case(
        path=f"{DYNAMIC_PATH}?plan_tier=business",
        metrics_endpoint=PATH,
    )

    mock_resolve.assert_called_once_with(None, endpoint=PATH)


@patch("sentry.seer.signed_seer_api.metrics.timer")
@pytest.mark.django_db
def test_times_request_with_metrics_endpoint(mock_metrics_timer: MagicMock) -> None:
    run_test_case(
        path=f"{PATH}/12345?dogs=great",
        metrics_endpoint=PATH,
    )
    mock_metrics_timer.assert_called_with(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": PATH},
    )


@pytest.mark.parametrize(
    ("status", "expected_status_class"),
    [(200, "2xx"), (404, "4xx"), (503, "5xx")],
)
@patch("sentry.utils.metrics.timing")
@override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
def test_times_request_with_status_class(
    mock_timing: MagicMock, status: int, expected_status_class: str
) -> None:
    pool = Mock(host="localhost", port=None, scheme="http")
    pool.urlopen.return_value = HTTPResponse(status=status)

    context = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1))
    with viewer_context_scope(context):
        response = make_signed_seer_api_request(pool, path=PATH, body=REQUEST_BODY)

    assert response.status == status
    tags = mock_timing.call_args.args[3]
    assert tags["status_class"] == expected_status_class
    assert tags["result"] == "success"


@patch("sentry.utils.metrics.timing")
@override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
def test_times_failed_request_with_error_status_class(mock_timing: MagicMock) -> None:
    pool = Mock(host="localhost", port=None, scheme="http")
    pool.urlopen.side_effect = ReadTimeoutError(HTTPConnectionPool("localhost"), PATH, "timed out")

    context = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1))
    with viewer_context_scope(context), pytest.raises(ReadTimeoutError):
        make_signed_seer_api_request(pool, path=PATH, body=REQUEST_BODY)

    tags = mock_timing.call_args.args[3]
    assert tags["status_class"] == "error"
    assert tags["result"] == "failure"


def test_missing_viewer_context_does_not_send_request() -> None:
    pool = Mock(host="localhost", port=None, scheme="http")

    with pytest.raises(MissingViewerContextError):
        make_signed_seer_api_request(
            pool,
            path=PATH,
            body=REQUEST_BODY,
            viewer_context=SeerViewerContext(organization_id=99, user_id=5),
        )

    pool.urlopen.assert_not_called()


@patch("sentry.seer.signed_seer_api.make_signed_seer_api_request")
def test_delete_grouping_records_uses_generic_metrics_endpoint(
    mock_seer_request: MagicMock,
) -> None:
    make_delete_grouping_records_by_project_request({"project_id": 4512086077276160})

    assert mock_seer_request.call_args.args[1].endswith("/delete/4512086077276160")
    assert (
        mock_seer_request.call_args.kwargs["metrics_endpoint"]
        == "/v0/issues/similar-issues/grouping-record/delete/:project_id"
    )


class TestResolveViewerContext:
    def test_changing_viewer_strips_elevation(self) -> None:
        ctx = ViewerContext(
            actor=Actor(
                type=ActorType.USER, actor_id=7, superuser=SuperuserAccess(expires_at=1234567890)
            ),
            organization_id=42,
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=43, user_id=7))
        assert isinstance(result, ViewerContext)
        assert result.actor.superuser is None

    def test_both_none(self) -> None:
        with pytest.raises(MissingViewerContextError):
            _resolve_viewer_context(None)

    def test_contextvar_only(self) -> None:
        ctx = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=7), organization_id=42)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(None)

        assert isinstance(result, ViewerContext)
        assert result.organization_id == 42
        assert result.actor.actor_id == 7
        assert result.actor.type == ActorType.USER

    @patch("sentry.seer.signed_seer_api.metrics")
    @patch("sentry.seer.signed_seer_api.logger")
    def test_explicit_only_raises_and_reports_contextvar_missing(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        with pytest.raises(MissingViewerContextError):
            _resolve_viewer_context(
                SeerViewerContext(organization_id=99, user_id=5),
                endpoint="/v1/automation/summarize",
            )

        mock_logger.warning.assert_called_once_with(
            "seer.viewer_context_not_set",
            extra={
                "explicit_org_id": 99,
                "explicit_user_id": 5,
                "endpoint": "/v1/automation/summarize",
            },
            stack_info=True,
        )
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "contextvar_missing", "endpoint": "/v1/automation/summarize"},
        )

    @patch("sentry.seer.signed_seer_api.metrics")
    @patch("sentry.seer.signed_seer_api.logger")
    def test_explicit_only_without_endpoint(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        with pytest.raises(MissingViewerContextError):
            _resolve_viewer_context(SeerViewerContext(organization_id=99))

        assert mock_logger.warning.call_args[1]["extra"]["endpoint"] is None
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "contextvar_missing", "endpoint": "unknown"},
        )

    def test_explicit_overrides_contextvar(self) -> None:
        ctx = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=7), organization_id=42)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=99))

        assert isinstance(result, ViewerContext)
        assert result.organization_id == 42
        assert result.actor.actor_id == 99
        assert result.actor.type == ActorType.USER

    @patch("sentry.seer.signed_seer_api.metrics")
    @patch("sentry.seer.signed_seer_api.logger")
    def test_mismatch_warns_and_clears_elevation(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        ctx = ViewerContext(
            actor=Actor(
                type=ActorType.USER, actor_id=7, superuser=SuperuserAccess(expires_at=1234567890)
            ),
            organization_id=42,
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(
                SeerViewerContext(organization_id=999), endpoint="/v1/automation/summarize"
            )

        assert isinstance(result, ViewerContext)
        assert result.organization_id == 999
        assert result.actor.superuser is None

        mock_logger.warning.assert_called_once()
        assert mock_logger.warning.call_args[0][0] == "seer.viewer_context_mismatch"
        assert mock_logger.warning.call_args[1]["extra"]["endpoint"] == "/v1/automation/summarize"
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={
                "outcome": "mismatch",
                "has_project": "false",
                "endpoint": "/v1/automation/summarize",
            },
        )

    @patch("sentry.seer.signed_seer_api.logger")
    def test_agent_mismatch_warns_and_keeps_agent(self, mock_logger: MagicMock) -> None:
        ctx = ViewerContext(
            actor=Actor(
                type=ActorType.AGENT,
                delegated_user_id=7,
                superuser=SuperuserAccess(expires_at=1234567890),
            ),
            organization_id=42,
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=43, user_id=99))

        assert isinstance(result, ViewerContext)
        assert result.organization_id == 43
        assert result.actor.type == ActorType.AGENT
        assert result.actor.delegated_user_id == 99
        assert result.actor.superuser is None
        assert mock_logger.warning.call_count == 2
        assert {c[1]["extra"]["field"] for c in mock_logger.warning.call_args_list} == {
            "organization_id",
            "user_id",
        }

    @patch("sentry.seer.signed_seer_api.logger")
    def test_service_account_is_not_reattributed_to_user(self, mock_logger: MagicMock) -> None:
        ctx = ViewerContext(
            actor=Actor(
                type=ActorType.SERVICE_ACCOUNT,
                actor_id=5,
                superuser=SuperuserAccess(expires_at=1234567890),
            ),
            organization_id=42,
            project_id=3,
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=99))

        assert isinstance(result, ViewerContext)
        assert result.actor.type == ActorType.SERVICE_ACCOUNT
        assert result.actor.actor_id == 5
        assert result.actor.superuser is None
        assert result.project_id is None
        mock_logger.warning.assert_called_once()
        assert mock_logger.warning.call_args[1]["extra"]["field"] == "user_id"

    @patch("sentry.seer.signed_seer_api.metrics")
    def test_match_emits_metric_with_project_id(self, mock_metrics: MagicMock) -> None:
        ctx = ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=7), organization_id=42, project_id=100
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=7))

        assert isinstance(result, ViewerContext)
        assert result.project_id == 100
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "match", "has_project": "true", "endpoint": "unknown"},
        )

    @patch("sentry.seer.signed_seer_api.metrics")
    def test_match_emits_metric_without_project_id(self, mock_metrics: MagicMock) -> None:
        ctx = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=7), organization_id=42)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=7))

        assert isinstance(result, ViewerContext)
        assert result.project_id is None
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "match", "has_project": "false", "endpoint": "unknown"},
        )
