from __future__ import absolute_import

from django.http import HttpRequest

from sentry.api.bases.integration import IntegrationEndpoint
from rest_framework.exceptions import APIException
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils import APITestCase


class IntegrationEndpointTest(APITestCase):
    def setUp(self):
        self.endpoint = IntegrationEndpoint()

    def test_handle_exception(self):
        exc = APIException("There was a problem!")
        exc.status_code = 400  # set the status code to 400 not possible to set in init
        exc.code = 400  # rest framework APIError is not compatible with integration APIError exception type
        resp = self.endpoint.handle_exception(HttpRequest(), exc)
        assert resp.status_code == 400
        assert resp.exception is True

    def test_handle_exception_503(self):
        resp = IntegrationEndpoint().handle_exception(
            HttpRequest(), ApiError("This is an error", code=503)
        )
        assert resp.status_code == 503
        assert resp.exception is True

    def test_handle_exception_stdlib(self):
        resp = IntegrationEndpoint().handle_exception(HttpRequest(), ValueError("This is an error"))
        assert resp.status_code == 500
        assert resp.exception is True
