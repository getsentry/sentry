from sentry.api.serializers import OrganizationMemberWithProjectsSerializer, serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationMemberListTest(APITestCase):
    endpoint = "sentry-api-0-organization-users"

    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")
        self.user_3 = self.create_user("unrelated@localhost", username="unrelated")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user_id=self.user_2.id)
        self.team_1 = self.create_team(
            organization=self.org, members=[self.owner_user, self.user_2]
        )
        self.team_2 = self.create_team(organization=self.org, members=[self.user_2])
        self.team_3 = self.create_team(organization=self.org, members=[self.user_3])
        self.project_1 = self.create_project(teams=[self.team_1])
        self.project_2 = self.create_project(teams=[self.team_2])
        self.project_3 = self.create_project(teams=[self.team_3])
        self.login_as(user=self.user_2)

    def test_simple(self):
        projects = [self.project_1, self.project_2]
        projects_ids = [p.id for p in projects]
        response = self.get_success_response(self.org.slug, project=projects_ids)
        expected = serialize(
            list(
                self.org.member_set.filter(
                    user_id__in=[self.owner_user.id, self.user_2.id]
                ).order_by("user_email")
            ),
            self.user_2,
            OrganizationMemberWithProjectsSerializer(projects=projects),
        )
        assert response.data == expected

        projects = [self.project_2]
        projects_ids = [p.id for p in projects]
        response = self.get_success_response(self.org.slug, project=projects_ids)
        expected = serialize(
            list(self.org.member_set.filter(user_id__in=[self.user_2.id]).order_by("id")),
            self.user_2,
            OrganizationMemberWithProjectsSerializer(projects=projects),
        )
        assert response.data == expected
