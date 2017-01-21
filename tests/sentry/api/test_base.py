from __future__ import absolute_import

import base64

from django.http import HttpRequest
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import ApiKey
from sentry.testutils import APITestCase


class DummyEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request):
        return Response({"ok": True})

_dummy_endpoint = DummyEndpoint.as_view()


class EndpointTest(APITestCase):
    def test_basic_cors(self):
        org = self.create_organization()
        apikey = ApiKey.objects.create(
            organization=org,
            allowed_origins='*',
        )

        request = HttpRequest()
        request.method = 'GET'
        request.META['HTTP_ORIGIN'] = 'http://example.com'
        request.META['HTTP_AUTHORIZATION'] = 'Basic {}'.format(
            base64.b64encode(apikey.key).decode('utf-8')
        )

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content

        assert response['Access-Control-Allow-Origin'] == 'http://example.com'
