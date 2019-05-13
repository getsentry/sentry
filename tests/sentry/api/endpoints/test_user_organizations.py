from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class UserOrganizationsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email="a@example.com")
        org = self.create_organization(name="foo")
        self.create_organization(name="bar")
        self.create_member(organization=org, user=user)

        self.login_as(user=user)

        url = reverse("sentry-api-0-user-organizations", kwargs={"user_id": "me"})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(org.id)
