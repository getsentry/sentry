from unittest import mock

from django.conf import settings

from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSCIMSerializer, TeamWithProjectsSerializer
from sentry.app import env
from sentry.models.organizationmember import InviteStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test

TEAM_CONTRIBUTOR = settings.SENTRY_TEAM_ROLES[0]
TEAM_ADMIN = settings.SENTRY_TEAM_ROLES[1]


@region_silo_test
class TeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result == {
            "id": str(team.id),
            "slug": team.slug,
            "name": team.name,
            "access": TEAM_CONTRIBUTOR["scopes"],
            "hasAccess": True,
            "isPending": False,
            "isMember": False,
            "teamRole": None,
            "flags": {"idp:provisioned": False},
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "memberCount": 0,
        }

    def test_simple_with_group_org_role(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization, org_role="manager")
        self.create_member(user=user, organization=organization, role="owner")

        result = serialize(team, user)
        assert result["orgRole"] == "manager"

    def test_member_count(self):
        user = self.create_user(username="foo")
        other_user = self.create_user(username="bar")
        third_user = self.create_user(username="baz")

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization, members=[user, other_user, third_user])

        result = serialize(team, user)
        assert result["memberCount"] == 3

    def test_member_count_does_not_include_invite_requests(self):
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)
        self.create_member(user=self.create_user(), organization=org, teams=[team])  # member
        self.create_member(email="1@example.com", organization=org, teams=[team])  # pending invite

        result = serialize(team, self.user)
        assert result["memberCount"] == 2

        # invite requests
        self.create_member(
            email="2@example.com",
            organization=org,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            teams=[team],
        )
        self.create_member(
            email="3@gmail.com",
            organization=org,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
            teams=[team],
        )

        result = serialize(team, self.user)
        assert result["memberCount"] == 2

    def test_member(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        self.create_member(user=user, organization=organization)

        result = serialize(team, user)
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_CONTRIBUTOR["id"]

    def test_member_with_team_role(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        self.create_member(user=user, organization=organization)

        result = serialize(team, user)
        assert result["access"] == TEAM_CONTRIBUTOR["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role="admin")
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]

    def test_admin(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        self.create_member(user=user, organization=organization, role="admin")

        result = serialize(team, user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == set()
        assert result["hasAccess"] is False
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role=None)
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]

    def test_manager(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="manager")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role=None)
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]

    def test_owner(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="owner")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role=None)
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]

    def test_superuser(self):
        user = self.create_user(username="foo", is_superuser=True)
        organization = self.create_organization()
        team = self.create_team(organization=organization)

        req = self.make_request()
        req.user = user
        req.superuser.set_logged_in(req.user)

        with mock.patch.object(env, "request", req):
            result = serialize(team, user)
            assert result["access"] == TEAM_ADMIN["scopes"]
            assert result["hasAccess"] is True
            assert result["isMember"] is False
            assert result["teamRole"] is None

            organization.flags.allow_joinleave = False
            organization.save()
            result = serialize(team, user)
            # after changing to allow_joinleave=False
            assert result["access"] == TEAM_ADMIN["scopes"]
            assert result["hasAccess"] is True
            assert result["isMember"] is False
            assert result["teamRole"] is None

    def test_member_on_owner_team(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        manager_team = self.create_team(organization=organization, org_role="manager")
        owner_team = self.create_team(organization=organization, org_role="owner")
        self.create_member(
            user=user, organization=organization, role="member", teams=[manager_team, owner_team]
        )
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role=None)
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]

    def test_member_with_team_role_on_owner_team(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        manager_team = self.create_team(organization=organization, org_role="manager")
        member = self.create_member(
            user=user, organization=organization, role="member", teams=[manager_team]
        )
        team = self.create_team(organization=organization)
        OrganizationMemberTeam(organizationmember=member, team=team, role="admin")

        result = serialize(team, user)
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team, role="contributor")
        result = serialize(team, user)
        # after giving them access to team
        assert result["access"] == TEAM_ADMIN["scopes"]
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == TEAM_ADMIN["id"]


@region_silo_test
class TeamWithProjectsSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")
        project2 = self.create_project(teams=[team], organization=organization, name="bar")

        result = serialize(team, user, TeamWithProjectsSerializer())
        serialized_projects = serialize([project2, project], user)

        assert result == {
            "id": str(team.id),
            "slug": team.slug,
            "name": team.name,
            "access": TEAM_CONTRIBUTOR["scopes"],
            "hasAccess": True,
            "isPending": False,
            "isMember": False,
            "teamRole": None,
            "flags": {"idp:provisioned": False},
            "projects": serialized_projects,
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "memberCount": 0,
            "dateCreated": team.date_added,
            "externalTeams": [],
        }


@region_silo_test
class TeamSCIMSerializerTest(TestCase):
    def test_simple_with_members(self):
        user = self.create_user(username="foo")
        user2 = self.create_user(username="bar")
        organization = self.create_organization()
        team = self.create_team(organization=organization, members=[user, user2])
        self.create_team(organization=organization, members=[user, user2])
        # create a 2nd team to confirm we aren't duping data

        result = serialize(team, user, TeamSCIMSerializer(expand=["members"]))
        assert result == {
            "displayName": team.name,
            "id": str(team.id),
            "members": [
                {"display": user.email, "value": str(team.member_set[0].id)},
                {"display": user2.email, "value": str(team.member_set[1].id)},
            ],
            "meta": {"resourceType": "Group"},
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        }

    def test_excluded_members(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization, members=[user])
        result = serialize(team, user, TeamSCIMSerializer())
        assert result == {
            "displayName": team.name,
            "id": str(team.id),
            "meta": {"resourceType": "Group"},
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        }
