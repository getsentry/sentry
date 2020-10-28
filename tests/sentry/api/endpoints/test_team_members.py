from __future__ import absolute_import

import six

from sentry.testutils import APITestCase
from sentry.models import InviteStatus


class TeamMembersTest(APITestCase):
    endpoint = "sentry-api-0-team-members"

    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.member = self.create_member(organization=self.org, user=self.create_user(), teams=[])
        self.team_member = self.create_member(
            organization=self.org, user=self.create_user("1@example.com"), teams=[self.team]
        )

    def test_simple(self):
        self.login_as(user=self.user)

        response = self.get_response(self.org.slug, self.team.slug)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.team_member.id)

    def test_team_members_list_does_not_include_invite_requests(self):
        pending_invite = self.create_member(
            email="a@example.com", organization=self.org, teams=[self.team]
        )

        # invite requests
        self.create_member(
            email="b@example.com",
            organization=self.org,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            teams=[self.team],
        )
        self.create_member(
            email="c@example.com",
            organization=self.org,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
            teams=[self.team],
        )
        self.login_as(user=self.user)

        response = self.get_response(self.org.slug, self.team.slug)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == six.text_type(self.team_member.id)
        assert response.data[1]["id"] == six.text_type(pending_invite.id)
