from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.utils.compat.mock import patch

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Team, TeamStatus, DeletedTeam
from sentry.testutils import APITestCase


class TeamDetailsTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(team.id)


class TeamUpdateTest(APITestCase):
    def test_simple(self):
        team = self.team  # force creation
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        resp = self.client.put(url, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 200, resp.content
        team = Team.objects.get(id=team.id)
        assert team.name == "hello world"
        assert team.slug == "foobar"


class TeamDeleteTest(APITestCase):
    def assert_team_deleted(self, team_id, mock_delete_team, transaction_id):
        """Checks team status, membership in DeletedTeams table, org
           audit log, and to see that delete function has been called"""

        team = Team.objects.get(id=team_id)

        assert team.status == TeamStatus.PENDING_DELETION

        deleted_team = DeletedTeam.objects.get(slug=team.slug)
        # in spite of the name, this checks the DeletedTeam object, not the
        # audit log
        self.assert_valid_deleted_log(deleted_team, team)

        # *this* actually checks the audit log
        audit_log_entry = AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.TEAM_REMOVE, target_object=team.id
        )
        assert audit_log_entry

        mock_delete_team.apply_async.assert_called_once_with(
            kwargs={"object_id": team.id, "transaction_id": transaction_id}
        )

    def assert_team_not_deleted(self, team_id, mock_delete_team):
        """Checks team status, membership in DeletedTeams table, org
           audit log, and to see that delete function has not been called"""

        team = Team.objects.get(id=team_id)

        assert team.status == TeamStatus.VISIBLE

        deleted_team = DeletedTeam.objects.filter(slug=team.slug)
        assert not deleted_team

        audit_log_entry = AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.TEAM_REMOVE, target_object=team.id
        )
        assert not audit_log_entry

        mock_delete_team.assert_not_called()  # NOQA

    @patch("sentry.api.endpoints.team_details.uuid4")
    @patch("sentry.api.endpoints.team_details.delete_team")
    def test_can_remove_as_admin_in_team(self, mock_delete_team, mock_uuid4):
        """Admins can remove teams of which they're a part"""

        # mock the transaction_id when mock_delete_team is called
        class uuid(object):
            hex = "abc123"

        mock_uuid4.return_value = uuid

        org = self.create_organization()
        team = self.create_team(organization=org)
        admin_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=admin_user, role="admin", teams=[team])

        self.login_as(admin_user)

        url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )

        response = self.client.delete(url)

        team = Team.objects.get(id=team.id)

        assert response.status_code == 204, response.data
        self.assert_team_deleted(team.id, mock_delete_team, "abc123")

    @patch("sentry.api.endpoints.team_details.uuid4")
    @patch("sentry.api.endpoints.team_details.delete_team")
    def test_remove_as_admin_not_in_team(self, mock_delete_team, mock_uuid4):
        """Admins can't remove teams of which they're not a part, unless
           open membership is on."""

        # mock the transaction_id when mock_delete_team is called
        class uuid(object):
            hex = "abc123"

        mock_uuid4.return_value = uuid

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

        url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )

        # first, try deleting the team with open membership off
        response = self.client.delete(url)

        assert response.status_code == 403
        self.assert_team_not_deleted(team.id, mock_delete_team)

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()
        response = self.client.delete(url)

        assert response.status_code == 204
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

        url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )

        response = self.client.delete(url)

        assert response.status_code == 403
        self.assert_team_not_deleted(team.id, mock_delete_team)
