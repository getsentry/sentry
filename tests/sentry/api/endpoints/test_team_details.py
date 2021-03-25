from typing import Optional

from sentry.utils.compat.mock import patch

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    DeletedTeam,
    Team,
    TeamStatus,
)
from sentry.testutils import APITestCase


class TeamDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def assert_team_status(
        self,
        team_id: int,
        mock_delete_team,
        status: TeamStatus,
        transaction_id: Optional[int] = None,
    ) -> None:
        team = Team.objects.get(id=team_id)

        assert team.status == status

        deleted_team = DeletedTeam.objects.filter(slug=team.slug)
        audit_log_entry = AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.TEAM_REMOVE, target_object=team.id
        )

        if status == TeamStatus.VISIBLE:
            assert not deleted_team
            assert not audit_log_entry
            mock_delete_team.assert_not_called()  # NOQA
            return

        # On spite of the name, this checks the DeletedTeam object, not the audit log
        self.assert_valid_deleted_log(deleted_team.get(), team)
        # *this* actually checks the audit log
        assert audit_log_entry.get()
        mock_delete_team.apply_async.assert_called_once_with(
            kwargs={"object_id": team.id, "transaction_id": transaction_id}
        )

    def assert_team_deleted(self, team_id, mock_delete_team, transaction_id):
        """
        Checks team status, membership in DeletedTeams table, org
        audit log, and to see that delete function has been called.
        """
        self.assert_team_status(
            team_id, mock_delete_team, TeamStatus.PENDING_DELETION, transaction_id
        )

    def assert_team_not_deleted(self, team_id, mock_delete_team):
        """
        Checks team status, membership in DeletedTeams table, org
        audit log, and to see that delete function has not been called.
        """
        self.assert_team_status(team_id, mock_delete_team, TeamStatus.VISIBLE)


class TeamDetailsTest(TeamDetailsTestBase):
    def test_simple(self):
        team = self.team  # force creation

        response = self.get_valid_response(team.organization.slug, team.slug)
        assert response.data["id"] == str(team.id)


class TeamUpdateTest(TeamDetailsTestBase):
    method = "put"

    def test_simple(self):
        team = self.team  # force creation

        self.get_valid_response(
            team.organization.slug, team.slug, name="hello world", slug="foobar"
        )

        team = Team.objects.get(id=team.id)
        assert team.name == "hello world"
        assert team.slug == "foobar"


class TeamDeleteTest(TeamDetailsTestBase):
    method = "delete"

    @patch("sentry.api.endpoints.team_details.uuid4")
    @patch("sentry.api.endpoints.team_details.delete_team")
    def test_can_remove_as_admin_in_team(self, mock_delete_team, mock_uuid4):
        """Admins can remove teams of which they're a part"""
        mock_uuid4.return_value = self.get_mock_uuid()

        org = self.create_organization()
        team = self.create_team(organization=org)
        admin_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=admin_user, role="admin", teams=[team])

        self.login_as(admin_user)

        self.get_valid_response(team.organization.slug, team.slug, status_code=204)

        team = Team.objects.get(id=team.id)
        self.assert_team_deleted(team.id, mock_delete_team, "abc123")

    @patch("sentry.api.endpoints.team_details.uuid4")
    @patch("sentry.api.endpoints.team_details.delete_team")
    def test_remove_as_admin_not_in_team(self, mock_delete_team, mock_uuid4):
        """Admins can't remove teams of which they're not a part, unless
        open membership is on."""
        mock_uuid4.return_value = self.get_mock_uuid()

        # an org with closed membership (byproduct of flags=0)
        org = self.create_organization(owner=self.user, flags=0)
        team = self.create_team(organization=org)
        admin_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(
            organization=org,
            user=admin_user,
            role="admin",
            teams=[],  # note that admin_user isn't a member of `team`
        )

        self.login_as(admin_user)

        # first, try deleting the team with open membership off
        self.get_valid_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id, mock_delete_team)

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()

        self.get_valid_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id, mock_delete_team, "abc123")

    @patch("sentry.api.endpoints.team_details.delete_team")
    def test_cannot_remove_as_member(self, mock_delete_team):
        """Members can't remove teams, even if they belong to them"""

        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)
        member_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(
            organization=org,
            user=member_user,
            role="member",
            teams=[team],  # note that member_user is a member of `team`
        )

        self.login_as(member_user)

        self.get_valid_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id, mock_delete_team)
