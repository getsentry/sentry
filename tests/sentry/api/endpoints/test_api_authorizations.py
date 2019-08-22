from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import ApiApplication, ApiAuthorization, ApiToken
from sentry.testutils import APITestCase


class ApiAuthorizationsListTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-authorizations")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(auth.id)


class ApiAuthorizationsDeleteTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(name="test", owner=self.user)
        auth = ApiAuthorization.objects.create(application=app, user=self.user)
        token = ApiToken.objects.create(application=app, user=self.user)
        self.login_as(self.user)
        url = reverse("sentry-api-0-api-authorizations")
        response = self.client.delete(url, data={"authorization": auth.id})
        assert response.status_code == 204
        assert not ApiAuthorization.objects.filter(id=auth.id).exists()
        assert not ApiToken.objects.filter(id=token.id).exists()
