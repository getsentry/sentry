from unittest.mock import MagicMock, patch

from django.http import HttpRequest
from rest_framework.exceptions import APIException
from rest_framework.request import Request

from sentry.integrations.api.bases.integration import IntegrationEndpoint
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


@patch("sys.stderr.write")
class IntegrationEndpointTest(TestCase):

    # Since both `IntegrationEndpoint.handle_exception_with_details` and `Endpoint.handle_exception_with_details` potentially
    # run, and they both call their own module's copy of `capture_exception`, in order to prove that
    # neither one is not called, we assert on the underlying method from the SDK
    @patch("sentry_sdk.Scope.capture_exception")
    def test_handle_rest_framework_exception(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        exc = APIException("There was a problem!")
        exc.status_code = 400  # not possible to set in init
        request = Request(HttpRequest())

        resp = IntegrationEndpoint().handle_exception_with_details(request, exc)

        # `APIException`s are handled by Django REST Framework's built-in exception handler, which
        # doesn't log errors or report them to Sentry
        assert mock_capture_exception.call_count == 0
        assert mock_stderror_write.call_count == 0

        assert resp.status_code == 400
        assert resp.exception is True

    @patch("sentry.integrations.api.bases.integration.capture_exception")
    def test_handle_exception_503(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        try:
            raise ApiError("This is an error", code=503)
        except ApiError as exc:
            request = Request(HttpRequest())

            resp = IntegrationEndpoint().handle_exception_with_details(request, exc)

            mock_capture_exception.assert_called_with(exc)
            (((s,), _),) = mock_stderror_write.call_args_list
            assert (
                s.splitlines()[-1]
                == "sentry.shared_integrations.exceptions.ApiError: This is an error"
            )

            assert resp.status_code == 503
            assert resp.exception is True

    @patch("sentry.api.base.capture_exception")
    def test_handle_exception_stdlib(
        self, mock_capture_exception: MagicMock, mock_stderror_write: MagicMock
    ):
        try:
            raise ValueError("This is an error")
        except ValueError as exc:
            request = Request(HttpRequest())

            resp = IntegrationEndpoint().handle_exception_with_details(request, exc)

            assert mock_capture_exception.call_args.args[0] == exc
            (((s,), _),) = mock_stderror_write.call_args_list
            assert s.splitlines()[-1] == "ValueError: This is an error"

            assert resp.status_code == 500
            assert resp.exception is True
