# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.models import InviteStatus
from sentry.testutils import TestCase


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
            "id": six.text_type(team.id),
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
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

    def test_admin_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="admin")
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

    def test_manager_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="manager")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True

    def test_owner_access(self):
        user = self.create_user(username="foo")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role="owner")
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop("dateCreated")

        assert result["hasAccess"] is True
        assert result["isMember"] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result["hasAccess"] is True
        assert result["isMember"] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result["hasAccess"] is True
        assert result["isMember"] is True


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
            "id": six.text_type(team.id),
            "projects": serialized_projects,
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "memberCount": 0,
            "dateCreated": team.date_added,
        }
