from __future__ import absolute_import

import six

from sentry.testutils import APITestCase


class CloudflareMetadataTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email="a@example.com")

        self.login_as(user=user)

        resp = self.client.get("/extensions/cloudflare/metadata/", format="json")

        assert resp.status_code == 200, resp.content
        assert resp.data["metadata"] == {
            "userId": six.text_type(user.id),
            "username": user.username,
            "email": user.email,
        }
