from sentry.api.serializers import OrganizationMemberWithProjectsSerializer, serialize
from sentry.api.serializers.models.organization_member import (
    OrganizationMemberSCIMSerializer,
    OrganizationMemberWithTeamsSerializer,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


class OrganizationMemberSerializerTest(TestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.team_2 = self.create_team(organization=self.org, members=[self.user_2])
        self.project = self.create_project(teams=[self.team])
        self.project_2 = self.create_project(teams=[self.team_2])

    def _get_org_members(self):
        return list(
            self.org.member_set.filter(user__in=[self.owner_user, self.user_2]).order_by(
                "user__email"
            )
        )


@region_silo_test
class OrganizationMemberWithProjectsSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self):
        projects = [self.project, self.project_2]
        org_members = self._get_org_members()
        result = serialize(
            org_members,
            self.user_2,
            OrganizationMemberWithProjectsSerializer(projects=projects),
        )
        expected_projects = [[self.project.slug, self.project_2.slug], [self.project.slug]]
        expected_projects[0].sort()
        assert [r["projects"] for r in result] == expected_projects

        projects = [self.project_2]
        result = serialize(
            org_members,
            self.user_2,
            OrganizationMemberWithProjectsSerializer(projects=projects),
        )
        expected_projects = [[self.project_2.slug], []]
        assert [r["projects"] for r in result] == expected_projects


@region_silo_test
class OrganizationMemberWithTeamsSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self):
        result = serialize(
            self._get_org_members(),
            self.user_2,
            OrganizationMemberWithTeamsSerializer(),
        )
        expected_teams = [[self.team.slug, self.team_2.slug], [self.team.slug]]
        expected_team_roles = [
            [
                {"teamSlug": self.team.slug, "role": None},
                {"teamSlug": self.team_2.slug, "role": None},
            ],
            [{"teamSlug": self.team.slug, "role": None}],
        ]
        assert [r["teams"] for r in result] == expected_teams
        assert [r["teamRoles"] for r in result] == expected_team_roles


@region_silo_test
class OrganizationMemberSCIMSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self):
        result = serialize(
            self._get_org_members()[0],
            self.user_2,
            OrganizationMemberSCIMSerializer(expand=["active"]),
        )
        assert "active" in result

    def test_no_active(self):
        result = serialize(
            self._get_org_members()[0],
            self.user_2,
            OrganizationMemberSCIMSerializer(),
        )
        assert "active" not in result
