from unittest.mock import MagicMock, Mock, patch

import pytest
from django.test import override_settings

from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.testutils.helpers import override_options

REQUEST_BODY = b'{"b": 12, "thing": "thing"}'
PATH = "/v0/some/url"


def run_test_case(
    path: str = PATH,
    timeout: int | None = None,
    shared_secret: str = "secret-one",
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
    with override_settings(SEER_API_SHARED_SECRET=shared_secret):
        make_signed_seer_api_request(
            mock,
            path=path,
            body=REQUEST_BODY,
            timeout=timeout,
        )

    return mock.urlopen


@pytest.mark.django_db
def test_simple():
    mock_url_open = run_test_case()
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={"content-type": "application/json;charset=utf-8"},
    )


@pytest.mark.django_db
def test_uses_given_timeout():
    mock_url_open = run_test_case(timeout=5)
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={"content-type": "application/json;charset=utf-8"},
        timeout=5,
    )


@pytest.mark.django_db
def test_uses_shared_secret():
    with override_options({"seer.api.use-shared-secret": 1.0}):
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
def test_uses_shared_secret_missing_secret():
    with override_options({"seer.api.use-shared-secret": 1.0}):
        mock_url_open = run_test_case(shared_secret="")

        mock_url_open.assert_called_once_with(
            "POST",
            PATH,
            body=REQUEST_BODY,
            headers={"content-type": "application/json;charset=utf-8"},
        )


@pytest.mark.django_db
@pytest.mark.parametrize("path", [PATH, f"{PATH}?dogs=great"])
@patch("sentry.seer.signed_seer_api.metrics.timer")
def test_times_request(mock_metrics_timer: MagicMock, path: str):
    run_test_case(path=path)
    mock_metrics_timer.assert_called_with(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={
            # In both cases the path is the same, because query params are stripped
            "endpoint": PATH,
        },
    )
