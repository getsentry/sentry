from unittest.mock import Mock

import pytest
from django.test import override_settings

from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.testutils.helpers import override_options

body = b'{"b": 12, "thing": "thing"}'


def run_test_case(timeout: int | None = None):
    """
    Make a mock connection pool, call `make_signed_seer_api_request` on it, and return the
    pool's `urlopen` method, so we can make assertions on how `make_signed_seer_api_request`
    used it.
    """
    mock = Mock()
    mock.host = "localhost"
    mock.port = None
    mock.scheme = "http"
    with override_settings(SEER_API_SHARED_SECRET="secret-one"):
        make_signed_seer_api_request(
            mock,
            path="/v0/some/url",
            body=body,
            timeout=timeout,
        )

    return mock.urlopen


@pytest.mark.django_db
def test_make_signed_seer_api_request():
    mock_url_open = run_test_case()
    mock_url_open.assert_called_once_with(
        "POST",
        "/v0/some/url",
        body=body,
        headers={"content-type": "application/json;charset=utf-8"},
    )

    mock_url_open = run_test_case(timeout=5)
    mock_url_open.assert_called_once_with(
        "POST",
        "/v0/some/url",
        body=body,
        headers={"content-type": "application/json;charset=utf-8"},
        timeout=5,
    )

    with override_options({"seer.api.use-shared-secret": 1.0}):
        mock_url_open = run_test_case()
        mock_url_open.assert_called_once_with(
            "POST",
            "/v0/some/url",
            body=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                "Authorization": "Rpcsignature rpc0:96f23d5b3df807a9dc91f090078a46c00e17fe8b0bc7ef08c9391fa8b37a66b5",
            },
        )
