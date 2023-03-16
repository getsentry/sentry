from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSCIMSerializer, TeamWithProjectsSerializer
from sentry.models import InviteStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result == {
            "slug": team.slug,
            "name": team.name,
            "hasAccess": True,
            "isPending": False,
            "isMember": False,
            "teamRole": None,
            "flags": {"idp:provisioned": False},
            "id": str(team.id),
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "orgRole": None,
            "memberCount": 0,
        }

    def test_member_count(self):
        user = self.create_user(username="foo")
        other_user = self.create_user(username="bar")
        third_user = self.create_user(username="baz")

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization, members=[user, other_user, third_user])

        result = serialize(team, user)
        assert 3 == result["memberCount"]

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

    def test_member_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is False
        assert result["isMember"] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "contributor"

    def test_admin_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="admin")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is False
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "admin"

    def test_manager_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="manager")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "admin"

    def test_owner_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="owner")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "admin"

    def test_member_on_owner_team_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        manager_team = self.create_team(organization=organization, org_role="manager")
        owner_team = self.create_team(organization=organization, org_role="owner")
        self.create_member(
            user=user, organization=organization, role="member", teams=[manager_team, owner_team]
        )
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "admin"

    def test_member_with_team_role_on_owner_team_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        manager_team = self.create_team(organization=organization, org_role="manager")
        member = self.create_member(
            user=user, organization=organization, role="member", teams=[manager_team]
        )
        team = self.create_team(organization=organization)
        OrganizationMemberTeam(organizationmember=member, team=team, role="admin")

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False
        assert result["teamRole"] is None

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True
        assert result["teamRole"] == "admin"

    def test_org_role(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="owner")
        team = self.create_team(organization=organization, org_role="manager")
        result = serialize(team, user)

        assert result["orgRole"] == "manager"


@region_silo_test
class TeamWithProjectsSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username="foo")
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name="foo")
        project2 = self.create_project(teams=[team], organization=organization, name="bar")

        result = serialize(team, user, TeamWithProjectsSerializer())
        serialized_projects = serialize([project2, project], user)

        assert result == {
            "slug": team.slug,
            "name": team.name,
            "hasAccess": True,
            "isPending": False,
            "isMember": False,
            "teamRole": None,
            "flags": {"idp:provisioned": False},
            "id": str(team.id),
            "projects": serialized_projects,
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "orgRole": None,
            "memberCount": 0,
            "dateCreated": team.date_added,
            "externalTeams": [],
        }


@region_silo_test
class TeamSCIMSerializerTest(TestCase):
    def test_simple_with_members(self):
        user = self.create_user(username="foo")
        user2 = self.create_user(username="bar")
        organization = self.create_organization(owner=user)
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
