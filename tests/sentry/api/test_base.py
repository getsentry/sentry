from __future__ import absolute_import

import base64
import pytest

from django.http import HttpRequest
from mock import Mock
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
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
        request.META['HTTP_AUTHORIZATION'] = 'Basic {}'.format(base64.b64encode(apikey.key))

        response = _dummy_endpoint(request)
        response.render()

        assert response.status_code == 200, response.content

        assert response['Access-Control-Allow-Origin'] == 'http://example.com'

    def test_xorg_attempts(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        xorg = self.create_organization()

        apikey = ApiKey.objects.create(
            organization=org,
            allowed_origins='*',
        )

        request = Mock()
        request.auth = apikey
        request.user = None
        request.method = 'GET'
        request.META = {'REMOTE_ADDR': '127.0.0.1'}
        request.parser_context = {}
        request.is_superuser = lambda: user.is_superuser
        endpoint = DummyEndpoint()

        # Test non-bail on ApiKey
        endpoint.bail_on_xorg(request, org)

        # Test bail on key-based xorg attempt
        assert request.auth.organization is not xorg
        with pytest.raises(ResourceDoesNotExist):
            endpoint.bail_on_xorg(request, xorg)

        # Test non-bail on User and org filter
        request.auth = None
        request.user = user
        assert not request.user.is_superuser
        assert request.user.is_authenticated()
        endpoint.bail_on_xorg(request, slug=org.slug)

        # Test bail on user-based xorg attempt
        assert user not in xorg.member_set.all()
        with pytest.raises(ResourceDoesNotExist):
            endpoint.bail_on_xorg(request, xorg)

        # Test bail on 404
        with pytest.raises(ResourceDoesNotExist):
            endpoint.bail_on_xorg(request, slug='doesnotexist')
