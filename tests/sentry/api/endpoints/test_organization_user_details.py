from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class OrganizationUserDetailsTest(APITestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.member = self.create_member(organization=self.org, user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-user-details", args=[self.org.slug, self.user.id]
        )

    def test_gets_info_for_user_in_org(self):
        self.login_as(user=self.owner_user)
        response = self.client.get(self.url)
        assert response.data["id"] == six.text_type(self.user.id)
        assert response.data["email"] == self.user.email

    def test_cannot_access_info_if_user_not_in_org(self):
        self.login_as(user=self.owner_user)
        user = self.create_user("meep@localhost", username="meep")
        url = reverse("sentry-api-0-organization-user-details", args=[self.org.slug, user.id])
        response = self.client.get(url)

        assert response.status_code == 404
