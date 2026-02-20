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

    def test_member_with_deleted_user(self) -> None:
        """
        Test that documents current serializer behavior when a member's user has been deleted.

        During hybrid cloud user deletion, there's an eventual consistency window where
        the user may be deleted from the control silo but the OrganizationMember still
        exists in the region silo with a user_id reference.

        CURRENT BEHAVIOR (as of 2026-02-17):
        When user_service.serialize_many() returns empty (user deleted), the serializer
        fails with AssertionError because:
        1. serialized_user is None (user was deleted)
        2. OrganizationMember.email is also None (cleared when user_id was set)
        3. The code hits: assert email is not None

        The base serializer catches the exception and returns None for the member.

        This test documents the current behavior, not necessarily the desired behavior.
        Future improvements might include:
        - Using user_email field as fallback
        - Returning a partial serialization with user=None but other fields populated
        """
        user = self.create_user(name="deleted_user", email="deleted@example.com")
        member = self.create_member(
            organization=self.org,
            user_id=user.id,
        )

        # Simulate the user being deleted but OrganizationMember still existing
        # by mocking the user service to return empty for this user
        with patch(
            "sentry.api.serializers.models.organization_member.base.user_service.serialize_many"
        ) as mock_serialize:
            mock_serialize.return_value = []  # No users returned (deleted)
            result = serialize(member, self.user_2, OrganizationMemberSerializer())

        # Current behavior: serializer returns None when email cannot be determined
        # This happens because both user.email (from deleted user) and member.email are None
        assert result is None


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
