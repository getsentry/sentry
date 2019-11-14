from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationHasProjectsTest(APITestCase):
    def setUp(self):
        self.foo = self.create_user("foo@example.com")
        self.bar = self.create_user("bar@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.url = reverse(
            "sentry-api-0-organization-has-projects", kwargs={"organization_slug": self.org.slug}
        )

    def test_simple_has_projects(self):
        # there are projects within a team that the user belongs to
        self.create_project(teams=[self.team])
        self.create_member(organization=self.org, user=self.foo, teams=[self.team])

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert response.data["hasProjects"]

    def test_simple_has_no_projects(self):
        # there are no projects in the organization
        self.create_member(organization=self.org, user=self.foo, teams=[self.team])

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert not response.data["hasProjects"]

    def test_user_belongs_to_no_projects(self):
        # there are projects in the org, but the user doesn't belong to it
        self.create_project(teams=[self.team])
        self.create_member(organization=self.org, user=self.foo)

        self.login_as(user=self.foo)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert not response.data["hasProjects"]

    def test_super_user_belongs_to_no_projects(self):
        # there are projects in the org, and the user is superuser
        self.create_project(teams=[self.team])
        self.create_member(organization=self.org, user=self.foo)

        self.login_as(user=self.bar, superuser=True)

        response = self.client.get(self.url)
        assert response.status_code == 200

        assert response.data["hasProjects"]
