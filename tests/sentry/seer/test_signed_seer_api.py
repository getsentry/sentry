from unittest.mock import MagicMock, Mock, patch

import pytest
import requests
import responses
from django.test import override_settings

from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    make_signed_seer_request_simple,
)
from sentry.testutils.helpers import override_options
from sentry.utils import json

REQUEST_BODY = b'{"b": 12, "thing": "thing"}'
PATH = "/v0/some/url"
URL = f"http://localhost:9999{PATH}"


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
        headers={"content-type": "application/json;charset=utf-8"},
    )


@pytest.mark.django_db
def test_uses_given_timeout() -> None:
    mock_url_open = run_test_case(timeout=5)
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={"content-type": "application/json;charset=utf-8"},
        timeout=5,
    )


@pytest.mark.django_db
def test_uses_given_retries() -> None:
    mock_url_open = run_test_case(retries=5)
    mock_url_open.assert_called_once_with(
        "POST",
        PATH,
        body=REQUEST_BODY,
        headers={"content-type": "application/json;charset=utf-8"},
        retries=5,
    )


@pytest.mark.django_db
def test_uses_shared_secret() -> None:
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
def test_uses_shared_secret_missing_secret() -> None:
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


@pytest.mark.parametrize("data_type", ["dict", "str"])
@patch("sentry.seer.signed_seer_api.sign_with_seer_secret")
@patch("requests.post")
def test_request_simple_success(mock_post: MagicMock, mock_sign: MagicMock, data_type: str) -> None:
    mock_response = Mock(json=Mock(return_value={"foo": "bar"}), status_code=200)
    mock_post.return_value = mock_response
    mock_sign.return_value = {"Authorization": "my-signature"}

    data = {"hello": "world"}
    response, status = make_signed_seer_request_simple(
        URL, data if data_type == "dict" else json.dumps(data), timeout=67
    )
    assert status == 200
    assert response.json() == {"foo": "bar"}
    assert response.status_code == 200

    str_data = json.dumps(data)
    mock_sign.assert_called_once_with(str_data.encode())

    assert mock_post.call_count == 1
    args, kwargs = mock_post.call_args
    assert args[0] == URL
    assert kwargs["data"] == str_data
    assert kwargs["headers"]["Authorization"] == "my-signature"
    assert kwargs["headers"]["content-type"] == "application/json;charset=utf-8"
    assert kwargs["timeout"] == 67


@pytest.mark.parametrize("data_type", ["dict", "str"])
@patch("sentry.seer.signed_seer_api.sign_with_seer_secret", Mock(return_value={}))
@patch("requests.post")
def test_request_simple_timeout_error(mock_post: MagicMock, data_type: str) -> None:
    mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

    _, status = make_signed_seer_request_simple(
        URL, {"hello": "world"} if data_type == "dict" else '{"hello": "world"}'
    )
    assert status == 504


@pytest.mark.parametrize("data_type", ["dict", "str"])
@patch("sentry.seer.signed_seer_api.sign_with_seer_secret", Mock(return_value={}))
@patch("requests.post")
def test_request_simple_connection_error(mock_post: MagicMock, data_type: str) -> None:
    mock_post.side_effect = requests.exceptions.ConnectionError("Connection error")

    _, status = make_signed_seer_request_simple(
        URL, {"hello": "world"} if data_type == "dict" else '{"hello": "world"}'
    )
    assert status == 502


@pytest.mark.parametrize("data_type", ["dict", "str"])
@patch("sentry.seer.signed_seer_api.sign_with_seer_secret", Mock(return_value={}))
@patch("requests.post")
def test_request_simple_request_error(mock_post: MagicMock, data_type: str) -> None:
    mock_post.side_effect = requests.exceptions.RequestException("Generic request error")

    _, status = make_signed_seer_request_simple(
        URL, {"hello": "world"} if data_type == "dict" else '{"hello": "world"}'
    )
    assert status == 502


@pytest.mark.parametrize("data_type", ["dict", "str"])
@pytest.mark.parametrize("expected_status", [400, 401, 403, 404, 429, 500, 502, 503, 504])
@patch("sentry.seer.signed_seer_api.sign_with_seer_secret", Mock(return_value={}))
@responses.activate
def test_request_simple_http_errors(expected_status: int, data_type: str) -> None:
    # Need a real response object to simulate raise_for_status().
    responses.add(
        responses.POST,
        URL,
        status=expected_status,
    )
    _, status = make_signed_seer_request_simple(
        URL, {"hello": "world"} if data_type == "dict" else '{"hello": "world"}'
    )
    assert status == expected_status
