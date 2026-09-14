from unittest.mock import MagicMock, Mock, patch

import pytest
from django.test import override_settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.auth.services.auth import AuthenticatedToken
from sentry.seer.signed_seer_api import (
    SeerViewerContext,
    _resolve_viewer_context,
    make_delete_grouping_records_by_project_request,
    make_signed_seer_api_request,
)
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope

REQUEST_BODY = b'{"b": 12, "thing": "thing"}'
PATH = "/v0/some/url"


def run_test_case(
    path: str = PATH,
    shared_secret: str = "secret-one",
    response_status: int = 200,
    urlopen_side_effect: Exception | None = None,
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
    mock.urlopen.return_value.status = response_status
    mock.urlopen.side_effect = urlopen_side_effect
    with override_settings(SEER_API_SHARED_SECRET=shared_secret):
        make_signed_seer_api_request(
            mock,
            path=path,
            body=REQUEST_BODY,
            **kwargs,
        )

    return mock.urlopen


@pytest.mark.django_db
def test_simple() -> None:
    mock_url_open = run_test_case()
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={
            "content-type": "application/json;charset=utf-8",
            "Authorization": "Rpcsignature rpc0:d2e6070dfab955db6fc9f3bc0518f75f27ca93ae2e393072929e5f6cba26ff07",
        },
    )


@pytest.mark.django_db
def test_preserves_query_string() -> None:
    mock_url_open = run_test_case(path=f"{PATH}?foo=bar&baz=qux", method="GET")
    assert mock_url_open.call_args.args[1] == f"{PATH}?foo=bar&baz=qux"


@pytest.mark.django_db
def test_uses_given_timeout() -> None:
    mock_url_open = run_test_case(timeout=5)
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={
            "content-type": "application/json;charset=utf-8",
            "Authorization": "Rpcsignature rpc0:d2e6070dfab955db6fc9f3bc0518f75f27ca93ae2e393072929e5f6cba26ff07",
        },
        timeout=5,
    )


@pytest.mark.django_db
def test_uses_given_retries() -> None:
    mock_url_open = run_test_case(retries=5)
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={
            "content-type": "application/json;charset=utf-8",
            "Authorization": "Rpcsignature rpc0:d2e6070dfab955db6fc9f3bc0518f75f27ca93ae2e393072929e5f6cba26ff07",
        },
        retries=5,
    )


@pytest.mark.django_db
def test_uses_shared_secret_missing_secret() -> None:
    mock_url_open = run_test_case(shared_secret="")

    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={"content-type": "application/json;charset=utf-8"},
    )


@pytest.mark.django_db
@patch("sentry.seer.signed_seer_api.metrics")
def test_missing_secret_emits_unsigned_request_metric(mock_metrics: MagicMock) -> None:
    run_test_case(shared_secret="")

    mock_metrics.incr.assert_any_call("seer.unsigned_request", sample_rate=1.0)


@pytest.mark.django_db
@pytest.mark.parametrize("path", [PATH, f"{PATH}?dogs=great"])
@patch("sentry.seer.signed_seer_api.metrics.timer")
def test_times_request(mock_metrics_timer: MagicMock, path: str) -> None:
    run_test_case(path=path)
    mock_metrics_timer.assert_called_with(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={
            # In both cases the path is the same, because query params are stripped
            "endpoint": PATH,
        },
    )


@pytest.mark.django_db
@patch("sentry.seer.signed_seer_api.metrics.timer")
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


@pytest.mark.django_db
@patch("sentry.seer.signed_seer_api.metrics.incr")
def test_counts_request_by_status(mock_metrics_incr: MagicMock) -> None:
    run_test_case(response_status=202, metrics_endpoint="/v0/some/:resource")

    mock_metrics_incr.assert_called_once_with(
        "seer.requests",
        sample_rate=1.0,
        tags={"endpoint": "/v0/some/:resource", "result": "202"},
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("error", "result"),
    [
        (TimeoutError("timed out"), "TimeoutError"),
        (MaxRetryError(pool=MagicMock(), url=PATH), "MaxRetryError"),
        (ValueError("bad response"), "ValueError"),
    ],
)
@patch("sentry.seer.signed_seer_api.metrics.incr")
def test_counts_request_exception(
    mock_metrics_incr: MagicMock, error: Exception, result: str
) -> None:
    with pytest.raises(type(error)):
        run_test_case(urlopen_side_effect=error)

    mock_metrics_incr.assert_called_once_with(
        "seer.requests",
        sample_rate=1.0,
        tags={"endpoint": PATH, "result": result},
    )


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
    def test_both_none(self) -> None:
        assert _resolve_viewer_context(None) is None

    def test_contextvar_only(self) -> None:
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(None)

        assert result is not None
        assert result.organization_id == 42
        assert result.user_id == 7
        assert result.actor_type == ActorType.USER

    @patch("sentry.seer.signed_seer_api.metrics")
    @patch("sentry.seer.signed_seer_api.logger")
    def test_explicit_only_warns_contextvar_missing(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        result = _resolve_viewer_context(SeerViewerContext(organization_id=99, user_id=5))
        assert result is not None
        assert result.organization_id == 99
        assert result.user_id == 5

        mock_logger.warning.assert_called_once_with(
            "seer.viewer_context_not_set",
            extra={
                "explicit_org_id": 99,
                "explicit_user_id": 5,
            },
        )
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "contextvar_missing"},
        )

    def test_contextvar_with_token(self) -> None:
        token = AuthenticatedToken(
            kind="api_token",
            scopes=["org:read", "project:write"],
            allowed_origins=[],
        )
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER, token=token)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(None)

        assert result is not None
        assert result.token is not None
        assert result.token.kind == "api_token"
        assert set(result.token.get_scopes()) == {"org:read", "project:write"}

    def test_explicit_overrides_contextvar(self) -> None:
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=99))

        assert result is not None
        assert result.organization_id == 42
        assert result.user_id == 99
        assert result.actor_type == ActorType.USER

    @patch("sentry.seer.signed_seer_api.metrics")
    @patch("sentry.seer.signed_seer_api.logger")
    def test_mismatch_warns_and_strips_token(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        token = AuthenticatedToken(
            kind="api_token",
            scopes=["org:read"],
            allowed_origins=[],
        )
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER, token=token)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=999))

        assert result is not None
        assert result.organization_id == 999
        assert result.token is None
        mock_logger.warning.assert_called_once()
        assert mock_logger.warning.call_args[0][0] == "seer.viewer_context_mismatch"
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "mismatch", "has_project": "false"},
        )

    @patch("sentry.seer.signed_seer_api.metrics")
    def test_match_emits_metric_with_project_id(self, mock_metrics: MagicMock) -> None:
        ctx = ViewerContext(
            organization_id=42, user_id=7, project_id=100, actor_type=ActorType.USER
        )
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=7))

        assert result is not None
        assert result.project_id == 100
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "match", "has_project": "true"},
        )

    @patch("sentry.seer.signed_seer_api.metrics")
    def test_match_emits_metric_without_project_id(self, mock_metrics: MagicMock) -> None:
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=7))

        assert result is not None
        assert result.project_id is None
        mock_metrics.incr.assert_called_once_with(
            "seer.viewer_context_resolution",
            tags={"outcome": "match", "has_project": "false"},
        )

    def test_no_mismatch_keeps_token(self) -> None:
        token = AuthenticatedToken(
            kind="api_token",
            scopes=["org:read"],
            allowed_origins=[],
        )
        ctx = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER, token=token)
        with viewer_context_scope(ctx):
            result = _resolve_viewer_context(SeerViewerContext(organization_id=42, user_id=7))

        assert result is not None
        assert result.token is not None
