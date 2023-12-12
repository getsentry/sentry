from unittest.mock import MagicMock, patch

from django.http import HttpRequest
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from sentry_sdk.utils import exc_info_from_error

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


@patch("sys.stderr.write")
class IntegrationEndpointTest(TestCase):

    # Since both `IntegrationEndpoint.handle_exception` and `Endpoint.handle_exception` potentially
    # run, and they both call their own module's copy of `capture_exception`, in order to prove that
    # neither one is not called, we assert on the underlying method from the SDK
    @patch("sentry_sdk.Hub.capture_exception")
    def test_handle_rest_framework_exception(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        exc = APIException("There was a problem!")
        exc.status_code = 400  # not possible to set in init
        request = Request(HttpRequest())

        resp = IntegrationEndpoint().handle_exception(request, exc)

        # `APIException`s are handled by Django REST Framework's built-in exception handler, which
        # doesn't log errors or report them to Sentry
        assert mock_capture_exception.call_count == 0
        assert mock_stderror_write.call_count == 0

        assert resp.status_code == 400
        assert resp.exception is True

    @patch("sentry.api.bases.integration.capture_exception")
    def test_handle_exception_503(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        exc = ApiError("This is an error", code=503)
        request = Request(HttpRequest())

        with patch("sys.exc_info", return_value=exc_info_from_error(exc)):
            resp = IntegrationEndpoint().handle_exception(request, exc)

            mock_capture_exception.assert_called_with(exc)
            mock_stderror_write.assert_called_with(
                "sentry.shared_integrations.exceptions.ApiError: This is an error\n"
            )

            assert resp.status_code == 503
            assert resp.exception is True

    @patch("sentry.api.base.capture_exception")
    def test_handle_exception_stdlib(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        exc = ValueError("This is an error")
        request = Request(HttpRequest())

        with patch("sys.exc_info", return_value=exc_info_from_error(exc)):
            resp = IntegrationEndpoint().handle_exception(request, exc)

            assert mock_capture_exception.call_args.args[0] == exc
            mock_stderror_write.assert_called_with("ValueError: This is an error\n")

            assert resp.status_code == 500
            assert resp.exception is True
