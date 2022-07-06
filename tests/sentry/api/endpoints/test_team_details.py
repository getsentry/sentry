from sentry import audit_log
from sentry.models import AuditLogEntry, DeletedTeam, ScheduledDeletion, Team, TeamStatus
from sentry.testutils import APITestCase


class TeamDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def assert_team_status(
        self,
        team_id: int,
        status: TeamStatus,
    ) -> None:
        team = Team.objects.get(id=team_id)

        assert team.status == status

        deleted_team = DeletedTeam.objects.filter(slug=team.slug)
        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("TEAM_REMOVE"), target_object=team.id
        )

        if status == TeamStatus.VISIBLE:
            assert not deleted_team
            assert not audit_log_entry
            assert not ScheduledDeletion.objects.filter(
                model_name="Team", object_id=team.id
            ).exists()
            return

        # In spite of the name, this checks the DeletedTeam object, not the audit log
        self.assert_valid_deleted_log(deleted_team.get(), team)
        # *this* actually checks the audit log
        assert audit_log_entry.get()
        # Ensure a scheduled deletion was made.
        assert ScheduledDeletion.objects.filter(model_name="Team", object_id=team.id).exists()

    def assert_team_deleted(self, team_id):
        """
        Checks team status, membership in DeletedTeams table, org
        audit log, and to see that delete function has been called.
        """
        self.assert_team_status(team_id, TeamStatus.PENDING_DELETION)

    def assert_team_not_deleted(self, team_id):
        """
        Checks team status, membership in DeletedTeams table, org
        audit log, and to see that delete function has not been called.
        """
        self.assert_team_status(team_id, TeamStatus.VISIBLE)


class TeamDetailsTest(TeamDetailsTestBase):
    def test_simple(self):
        team = self.team  # force creation

        response = self.get_success_response(team.organization.slug, team.slug)
        assert response.data["id"] == str(team.id)


class TeamUpdateTest(TeamDetailsTestBase):
    method = "put"

    def test_simple(self):
        team = self.team  # force creation

        self.get_success_response(
            team.organization.slug, team.slug, name="hello world", slug="foobar"
        )

        team = Team.objects.get(id=team.id)
        assert team.name == "hello world"
        assert team.slug == "foobar"


class TeamDeleteTest(TeamDetailsTestBase):
    method = "delete"

    def test_rename_on_delete(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org, slug="something-moderately-long")
        admin_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=admin_user, role="admin", teams=[team])

        self.login_as(admin_user)

        self.get_success_response(team.organization.slug, team.slug, status_code=204)

        original_slug = team.slug
        team.refresh_from_db()
        self.assert_team_deleted(team.id)
        assert original_slug != team.slug, "Slug should be released on delete."

    def test_can_remove_as_admin_in_team(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        admin_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=admin_user, role="admin", teams=[team])

        self.login_as(admin_user)

        self.get_success_response(team.organization.slug, team.slug, status_code=204)

        team.refresh_from_db()
        self.assert_team_deleted(team.id)

    def test_remove_as_admin_not_in_team(self):
        """Admins can't remove teams of which they're not a part, unless
        open membership is on."""

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
        self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()

        self.get_success_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id)

    def test_cannot_remove_as_member(self):
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

        self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)
