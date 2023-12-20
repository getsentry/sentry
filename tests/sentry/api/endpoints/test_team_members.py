from sentry.models.organizationmember import InviteStatus
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
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
        assert response.data[0]["id"] == str(self.team_member.id)

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
        assert response.data[1]["id"] == str(self.team_member.id)
        assert response.data[0]["id"] == str(pending_invite.id)

    def test_team_members_list_does_not_include_inactive_users(self):
        inactive_user = self.create_user(email="inactive@example.com")
        inactive_user.is_active = False
        with outbox_runner():
            with assume_test_silo_mode(SiloMode.CONTROL):
                inactive_user.save()
            inactive_member = self.create_member(
                organization=self.org,
                user=inactive_user,
                teams=[self.team],
            )

        self.login_as(user=self.user)

        response = self.get_response(self.org.slug, self.team.slug)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] != str(inactive_member.id)

    def test_team_members_list_includes_roles(self):
        self.login_as(user=self.user)

        response = self.get_response(self.org.slug, self.team.slug)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["teamRole"] is None
        assert response.data[0]["teamSlug"] == self.team.slug
