from __future__ import absolute_import

import base64

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class LoginTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email="a@example.com")
        user.set_password("test")
        user.save()

        auth_header = b"Basic " + base64.b64encode(b"a@example.com:test")

        url = reverse("sentry-api-0-auth")
        response = self.client.post(url, format="json", HTTP_AUTHORIZATION=auth_header)

        assert response.status_code == 200, response.content


class LogoutTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user)

        url = reverse("sentry-api-0-auth")
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.content
