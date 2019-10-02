from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationUserTeamsTest(APITestCase):
    def setUp(self):
        self.foo = self.create_user("foo@example.com")
        self.bar = self.create_user("bar@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user)
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.team3 = self.create_team(organization=self.org)
        self.project1 = self.create_project(teams=[self.team1])
        self.project2 = self.create_project(teams=[self.team2])
        self.create_member(organization=self.org, user=self.foo, teams=[self.team1, self.team2])
        self.create_member(organization=self.org, user=self.bar, teams=[self.team2])

        self.url = reverse(
            "sentry-api-0-organization-user-teams", kwargs={"organization_slug": self.org.slug}
        )

    def test_simple(self):
        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        # Verify that only teams that the user is a member of, are returned
        assert len(response.data) == 2

        # Sort teams so there is a guaranteed ordering
        response.data.sort(key=lambda x: x["id"])
        assert response.data[0]["id"] == six.text_type(self.team1.id)
        assert response.data[0]["isMember"]
        assert response.data[0]["projects"][0]["id"] == six.text_type(self.project1.id)

        assert response.data[1]["id"] == six.text_type(self.team2.id)
        assert response.data[1]["isMember"]
        assert response.data[1]["projects"][0]["id"] == six.text_type(self.project2.id)

    def test_super_user(self):
        self.login_as(user=self.bar, superuser=True)

        response = self.client.get(self.url)
        assert response.status_code == 200

        # Verify that all teams are returned
        assert len(response.data) == 3

        # Sort teams so there is a guaranteed ordering
        response.data.sort(key=lambda x: x["id"])
        assert response.data[0]["id"] == six.text_type(self.team1.id)
        assert not response.data[0]["isMember"]
        assert response.data[0]["projects"][0]["id"] == six.text_type(self.project1.id)

        assert response.data[1]["id"] == six.text_type(self.team2.id)
        assert response.data[1]["isMember"]
        assert response.data[1]["projects"][0]["id"] == six.text_type(self.project2.id)

        assert response.data[2]["id"] == six.text_type(self.team3.id)
        assert not response.data[2]["isMember"]
