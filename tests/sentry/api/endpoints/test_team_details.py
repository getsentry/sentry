from sentry import audit_log
from sentry.audit_log.services.log.service import log_rpc_service
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.deletedteam import DeletedTeam
from sentry.models.team import Team, TeamStatus
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.outbox import outbox_runner


class TeamDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def assert_team_status(
        self,
        team_id: int,
        status: int,
    ) -> None:
        team = Team.objects.get(id=team_id)

        assert team.status == status

        deleted_team = DeletedTeam.objects.filter(slug=team.slug)
        audit_log_event = log_rpc_service.find_last_log(
            organization_id=team.organization_id,
            event=audit_log.get_event_id("TEAM_REMOVE"),
            target_object_id=team.id,
        )
        scheduled_deletion_exists = RegionScheduledDeletion.objects.filter(
            model_name="Team", object_id=team.id
        ).exists()

        if status == TeamStatus.ACTIVE:
            assert not deleted_team
            assert audit_log_event is None
            assert not scheduled_deletion_exists
        else:
            # In spite of the name, this checks the DeletedTeam object, not the audit log
            self.assert_valid_deleted_log(deleted_team.get(), team)
            assert audit_log_event
            assert scheduled_deletion_exists

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
        self.assert_team_status(team_id, TeamStatus.ACTIVE)


class TeamDetailsTest(TeamDetailsTestBase):
    def test_simple(self):
        team = self.team  # force creation

        response = self.get_success_response(team.organization.slug, team.slug)
        assert response.data["id"] == str(team.id)

        response = self.get_success_response(team.organization.slug, team.id)
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

    def test_invalid_numeric_slug(self):
        response = self.get_error_response(self.organization.slug, self.team.slug, slug="1234")
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_member_without_team_role(self):
        user = self.create_user("foo@example.com")
        team = self.create_team()
        member = self.create_member(user=user, organization=self.organization, role="member")

        self.create_team_membership(team, member)
        self.login_as(user)

        self.get_error_response(team.organization.slug, team.slug, slug="foobar", status_code=403)

    @with_feature("organizations:team-roles")
    def test_member_with_team_role(self):
        user = self.create_user("foo@example.com")
        team = self.create_team()
        member = self.create_member(user=user, organization=self.organization, role="member")

        self.create_team_membership(team, member, role="admin")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_admin_with_team_membership_with_id(self):
        """Admins can modify their teams"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.id, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_admin_with_team_membership(self):
        """Admins can modify their teams"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_admin_without_team_membership(self):
        """Admins can't modify teams of which they're not inside, unless
        open membership is on."""

        # an org with closed membership (byproduct of flags=0)
        org = self.create_organization(owner=self.user, flags=0)
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[])
        self.login_as(user)

        # first, try deleting the team with open membership off
        self.get_error_response(team.organization.slug, team.slug, slug="foobar", status_code=403)
        curr_slug = team.slug
        team = Team.objects.get(id=team.id)
        assert team.slug == curr_slug

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()

        self.get_success_response(team.organization.slug, team.slug, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_manager_without_team_membership(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="manager")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_owner_without_team_membership(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="owner")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, name="foo", slug="bar")

        team = Team.objects.get(id=team.id)
        assert team.name == "foo"
        assert team.slug == "bar"

    def test_cannot_modify_idp_provisioned_teams(self):
        org = self.create_organization(owner=self.user)
        idp_team = self.create_team(organization=org, idp_provisioned=True)

        self.login_as(self.user)
        self.get_error_response(
            idp_team.organization.slug, idp_team.slug, name="foo", slug="bar", status_code=403
        )


class TeamDeleteTest(TeamDetailsTestBase):
    method = "delete"

    def test_rename_on_delete(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org, slug="something-moderately-long")
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.slug, status_code=204)

        original_slug = team.slug
        team.refresh_from_db()
        self.assert_team_deleted(team.id)
        assert original_slug != team.slug, "Slug should be released on delete."

    def test_member(self):
        """Members can't remove teams, even if they belong to them"""
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)
        member_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=member_user, role="member", teams=[team])
        self.login_as(member_user)

        with outbox_runner():
            self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)

    @with_feature("organizations:team-roles")
    def test_member_with_team_role(self):
        user = self.create_user("foo@example.com")
        team = self.create_team()
        member = self.create_member(user=user, organization=self.organization, role="member")

        self.create_team_membership(team, member, role="admin")
        self.login_as(user)

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id)

    def test_admin_with_team_membership(self):
        """Admins can delete their teams"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.slug, status_code=204)

        team.refresh_from_db()
        self.assert_team_deleted(team.id)

    def test_admin_with_team_membership_with_id(self):
        """Admins can delete their teams"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.id, status_code=204)

        team.refresh_from_db()
        self.assert_team_deleted(team.id)

    def test_admin_without_team_membership(self):
        """Admins can't delete teams of which they're not inside, unless
        open membership is on."""

        # an org with closed membership (byproduct of flags=0)
        org = self.create_organization(owner=self.user, flags=0)
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[])
        self.login_as(user)

        # first, try deleting the team with open membership off
        with outbox_runner():
            self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id)

    def test_manager_without_team_membership(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        manager_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=manager_user, role="manager")
        self.login_as(manager_user)

        with outbox_runner():
            self.get_success_response(team.organization.slug, team.slug, status_code=204)

        team.refresh_from_db()
        self.assert_team_deleted(team.id)

    def test_cannot_delete_idp_provisioned_teams(self):
        org = self.create_organization(owner=self.user)
        idp_team = self.create_team(organization=org, idp_provisioned=True)

        self.login_as(self.user)
        with outbox_runner():
            self.get_error_response(
                idp_team.organization.slug, idp_team.slug, name="foo", slug="bar", status_code=403
            )
        self.assert_team_not_deleted(idp_team.id)
