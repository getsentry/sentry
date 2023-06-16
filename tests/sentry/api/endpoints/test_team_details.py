from sentry import audit_log
from sentry.models import AuditLogEntry, DeletedTeam, ScheduledDeletion, Team, TeamStatus
from sentry.testutils import APITestCase
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


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

        if status == TeamStatus.ACTIVE:
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
        self.assert_team_status(team_id, TeamStatus.ACTIVE)


@region_silo_test
class TeamDetailsTest(TeamDetailsTestBase):
    def test_simple(self):
        team = self.team  # force creation

        response = self.get_success_response(team.organization.slug, team.slug)
        assert response.data["id"] == str(team.id)


@region_silo_test
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

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__success(self):
        team = self.team
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, orgRole="owner")

        team = Team.objects.get(id=team.id)
        assert team.org_role == "owner"

        data = {
            "id": team.id,
            "slug": team.slug,
            "name": team.name,
            "status": team.status,
            "org_role": "owner",
            "old_org_role": None,
        }
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("TEAM_EDIT"),
            data=data,
        )

        test_team_edit = audit_log.get(21)
        assert (
            test_team_edit.render(AuditLogEntry.objects.get(event=21))
            == f"edited team {team.slug}'s org role to owner"
        )

    def test_put_team_org_role__missing_flag(self):
        # the put goes through but doesn't update the org role field
        team = self.team
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, orgRole="owner")

        team = Team.objects.get(id=team.id)
        assert not team.org_role
        test_team_edit = audit_log.get(21)
        assert (
            test_team_edit.render(AuditLogEntry.objects.get(event=21)) == f"edited team {team.slug}"
        )

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__success_with_org_role_from_team(self):
        team = self.team
        user = self.create_user("foo@example.com")
        member_team = self.create_team(org_role="owner")

        self.create_member(
            user=user, organization=self.organization, role="member", teams=[member_team]
        )
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, orgRole="owner")

        team = Team.objects.get(id=team.id)
        assert team.org_role == "owner"

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__member(self):
        team = self.team
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="member")
        self.login_as(user)

        response = self.get_error_response(
            team.organization.slug, team.slug, orgRole="owner", status_code=403
        )
        assert response.data["detail"] == "You do not have permission to perform this action."

        team = Team.objects.get(id=team.id)
        assert not team.org_role

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__manager(self):
        team = self.team
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="manager")
        self.login_as(user)

        response = self.get_error_response(
            team.organization.slug, team.slug, orgRole="owner", status_code=403
        )
        assert response.data["detail"] == "You must have the role of owner to perform this action."

        team = Team.objects.get(id=team.id)
        assert not team.org_role

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__invalid_role(self):
        team = self.team
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        self.get_error_response(team.organization.slug, team.slug, orgRole="onwer", status_code=400)

        team = Team.objects.get(id=team.id)
        assert not team.org_role

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__idp_provisioned_team(self):
        team = self.create_team(idp_provisioned=True)
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        response = self.get_error_response(
            team.organization.slug, team.slug, orgRole="owner", status_code=403
        )

        assert (
            response.data["detail"]
            == "This team is managed through your organization's identity provider."
        )
        team = Team.objects.get(id=team.id)
        assert not team.org_role

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__remove_success(self):
        team = self.create_team(org_role="owner")
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, orgRole="")

        team = Team.objects.get(id=team.id)
        assert not team.org_role

    @with_feature("organizations:org-roles-for-teams")
    def test_put_team_org_role__remove_error(self):
        team = self.create_team(org_role="owner")
        user = self.create_user("foo@example.com")

        self.create_member(user=user, organization=self.organization, role="admin")
        self.login_as(user)

        self.get_error_response(team.organization.slug, team.slug, orgRole="", status_code=403)

        team = Team.objects.get(id=team.id)
        assert team.org_role == "owner"


@region_silo_test
class TeamDeleteTest(TeamDetailsTestBase):
    method = "delete"

    def test_rename_on_delete(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org, slug="something-moderately-long")
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

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

        self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)

    @with_feature("organizations:team-roles")
    def test_member_with_team_role(self):
        user = self.create_user("foo@example.com")
        team = self.create_team()
        member = self.create_member(user=user, organization=self.organization, role="member")

        self.create_team_membership(team, member, role="admin")
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id)

    def test_admin_with_team_membership(self):
        """Admins can delete their teams"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=user, role="admin", teams=[team])
        self.login_as(user)

        self.get_success_response(team.organization.slug, team.slug, status_code=204)

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
        self.get_error_response(team.organization.slug, team.slug, status_code=403)
        self.assert_team_not_deleted(team.id)

        # now, with open membership on
        org.flags.allow_joinleave = True
        org.save()

        self.get_success_response(team.organization.slug, team.slug, status_code=204)
        self.assert_team_deleted(team.id)

    def test_manager_without_team_membership(self):
        """Admins can remove teams of which they're a part"""
        org = self.create_organization()
        team = self.create_team(organization=org)
        manager_user = self.create_user(email="foo@example.com", is_superuser=False)

        self.create_member(organization=org, user=manager_user, role="manager")
        self.login_as(manager_user)

        self.get_success_response(team.organization.slug, team.slug, status_code=204)

        team.refresh_from_db()
        self.assert_team_deleted(team.id)
