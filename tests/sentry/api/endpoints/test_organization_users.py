from __future__ import absolute_import

from sentry.api.serializers import OrganizationMemberWithProjectsSerializer, serialize
from sentry.testutils import APITestCase


class OrganizationMemberListTest(APITestCase):
    endpoint = "sentry-api-0-organization-users"

    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")
        self.user_3 = self.create_user("unrelated@localhost", username="unrelated")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.team_2 = self.create_team(organization=self.org, members=[self.user_2])
        self.team_3 = self.create_team(organization=self.org, members=[self.user_3])
        self.project = self.create_project(teams=[self.team])
        self.project_2 = self.create_project(teams=[self.team_2])
        self.project_3 = self.create_project(teams=[self.team_3])

        self.login_as(user=self.user_2)

    def test_simple(self):
        projects_ids = [self.project.id, self.project_2.id]
        response = self.get_valid_response(self.org.slug, project=projects_ids)
        expected = serialize(
            list(
                self.org.member_set.filter(user__in=[self.owner_user, self.user_2]).order_by(
                    "user__email"
                )
            ),
            self.user_2,
            OrganizationMemberWithProjectsSerializer(project_ids=projects_ids),
        )
        assert response.data == expected

        projects_ids = [self.project_2.id]
        response = self.get_valid_response(self.org.slug, project=projects_ids)
        expected = serialize(
            list(self.org.member_set.filter(user__in=[self.user_2]).order_by("user__email")),
            self.user_2,
            OrganizationMemberWithProjectsSerializer(project_ids=projects_ids),
        )
        assert response.data == expected
