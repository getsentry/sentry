from unittest.mock import patch

from sentry.api.serializers import (
    OrganizationMemberSerializer,
    OrganizationMemberWithProjectsSerializer,
    serialize,
)
from sentry.api.serializers.models.organization_member import (
    OrganizationMemberSCIMSerializer,
    OrganizationMemberWithTeamsSerializer,
)
from sentry.models.organizationmember import InviteStatus
from sentry.testutils.cases import TestCase
from sentry.users.models.user import User


class OrganizationMemberSerializerTest(TestCase):
    def setUp(self) -> None:
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user_id=self.user_2.id)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.team_2 = self.create_team(organization=self.org, members=[self.user_2])
        self.project = self.create_project(teams=[self.team])
        self.project_2 = self.create_project(teams=[self.team_2])

    def _get_org_members(self) -> list[User]:
        return list(
            self.org.member_set.filter(user_id__in=[self.owner_user.id, self.user_2.id]).order_by(
                "user_email"
            )
        )

    def test_inviter(self) -> None:
        inviter = self.create_user(name="bob")
        member = self.create_member(
            organization=self.org,
            email="foo@sentry.io",
            inviter_id=inviter.id,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        result = serialize(member, self.user_2, OrganizationMemberSerializer())
        assert result["inviteStatus"] == "requested_to_join"
        assert result["inviterName"] == "bob"

    def test_user(self) -> None:
        user = self.create_user(name="bob")
        member = self.create_member(
            organization=self.org,
            user_id=user.id,
        )
        result = serialize(member, self.user_2, OrganizationMemberSerializer())
        assert result["user"]["id"] == str(user.id)
        assert result["user"]["name"] == "bob"

    def test_serialize_many_returns_none_values(self) -> None:
        """
        Test that the serializer handles None values returned from user_service.serialize_many.

        This can happen due to serialization failures in the user service.
        """
        user = self.create_user(name="charlie", email="charlie@example.com")
        member = self.create_member(
            organization=self.org,
            user_id=user.id,
        )

        # Mock serialize_many to return a list containing None values
        with patch(
            "sentry.api.serializers.models.organization_member.base.user_service.serialize_many"
        ) as mock_serialize_many:
            mock_serialize_many.return_value = [None, None]

            result = serialize(member, self.user_2, OrganizationMemberSerializer())

            # When user serialization fails, the member should still be serialized
            # but with user=None and email falling back to member's email
            assert result["user"] is None
            assert result["email"] == member.email
            assert result["name"] == member.email


class OrganizationMemberWithProjectsSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self) -> None:
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


class OrganizationMemberWithTeamsSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self) -> None:
        result = serialize(
            self._get_org_members(),
            self.user_2,
            OrganizationMemberWithTeamsSerializer(),
        )
        expected_teams = [
            [self.team.slug, self.team_2.slug],
            [self.team.slug],
        ]
        expected_team_roles = [
            [
                {"teamSlug": self.team.slug, "role": None},
                {"teamSlug": self.team_2.slug, "role": None},
            ],
            [{"teamSlug": self.team.slug, "role": None}],
        ]
        assert [r["teams"] for r in result] == expected_teams
        assert [r["teamRoles"] for r in result] == expected_team_roles


class OrganizationMemberSCIMSerializerTest(OrganizationMemberSerializerTest):
    def test_simple(self) -> None:
        result = serialize(
            self._get_org_members()[0],
            self.user_2,
            OrganizationMemberSCIMSerializer(expand=["active"]),
        )
        assert "active" in result

    def test_no_active(self) -> None:
        result = serialize(
            self._get_org_members()[0],
            self.user_2,
            OrganizationMemberSCIMSerializer(),
        )
        assert "active" not in result
