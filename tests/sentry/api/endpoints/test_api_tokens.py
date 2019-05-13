from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ApiToken
from sentry.testutils import APITestCase


class ApiTokensListTest(APITestCase):
    def test_simple(self):
        ApiToken.objects.create(user=self.user)
        ApiToken.objects.create(user=self.user)

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2


class ApiTokensCreateTest(APITestCase):
    def test_no_scopes(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(url)
        assert response.status_code == 400

    def test_simple(self):
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.post(url, data={"scopes": ["event:read"]})
        assert response.status_code == 201
        token = ApiToken.objects.get(user=self.user)
        assert not token.expires_at
        assert not token.refresh_token
        assert token.get_scopes() == ["event:read"]


class ApiTokensDeleteTest(APITestCase):
    def test_simple(self):
        token = ApiToken.objects.create(user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-tokens")
        response = self.client.delete(url, data={"token": token.token})
        assert response.status_code == 204
        assert not ApiToken.objects.filter(id=token.id).exists()
