from django.test import override_settings
from pytest import fixture

from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.models.deletedorganization import DeletedOrganization
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.userpermission import UserPermission
from sentry.users.models.userrole import UserRole


class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="a@example.com", is_managed=False, name="example name")
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.login_as(user=self.user)


@control_silo_test
class UserDetailsGetTest(UserDetailsTest):
    # TODO(dcramer): theres currently no way to look up other users
    def test_look_up_other_user(self):
        user2 = self.create_user(email="b@example.com")
        self.get_error_response(user2.id, status_code=403)

    def test_lookup_self(self):
        resp = self.get_success_response("me")

        assert resp.data["id"] == str(self.user.id)
        assert resp.data["options"]["theme"] == "light"
        assert resp.data["options"]["defaultIssueEvent"] == "recommended"
        assert resp.data["options"]["timezone"] == "UTC"
        assert resp.data["options"]["language"] == "en"
        assert resp.data["options"]["stacktraceOrder"] == -1
        assert not resp.data["options"]["clock24Hours"]
        assert not resp.data["options"]["prefersIssueDetailsStreamlinedUI"]
        assert not resp.data["options"]["prefersStackedNavigation"]
        assert not resp.data["options"]["quickStartDisplay"]

    def test_superuser_simple(self):
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(self.user.id)

        assert resp.data["id"] == str(self.user.id)
        assert "identities" in resp.data
        assert len(resp.data["identities"]) == 0

    @override_options({"staff.ga-rollout": True})
    def test_staff_simple(self):
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(self.user.id)

        assert resp.data["id"] == str(self.user.id)
        assert "identities" in resp.data
        assert len(resp.data["identities"]) == 0

    def test_superuser_includes_roles_and_permissions(self):
        self.add_user_permission(self.superuser, "users.admin")
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(self.superuser.id)

        assert resp.data["id"] == str(self.superuser.id)
        assert "permissions" in resp.data
        assert resp.data["permissions"] == ["users.admin"]

        role = UserRole.objects.create(name="test", permissions=["broadcasts.admin"])
        role.users.add(self.superuser)

        resp = self.get_success_response(self.superuser.id)
        assert resp.data["permissions"] == ["broadcasts.admin", "users.admin"]

    def test_staff_includes_roles_and_permissions(self):
        self.add_user_permission(self.staff_user, "users.admin")
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(self.staff_user.id)

        assert resp.data["id"] == str(self.staff_user.id)
        assert "permissions" in resp.data
        assert resp.data["permissions"] == ["users.admin"]

        role = UserRole.objects.create(name="test", permissions=["broadcasts.admin"])
        role.users.add(self.staff_user)

        resp = self.get_success_response(self.staff_user.id)
        assert resp.data["permissions"] == ["broadcasts.admin", "users.admin"]


@control_silo_test
class UserDetailsUpdateTest(UserDetailsTest):
    method = "put"

    def test_simple(self):
        resp = self.get_success_response(
            "me",
            name="hello world",
            options={
                "theme": "system",
                "defaultIssueEvent": "latest",
                "timezone": "UTC",
                "stacktraceOrder": "2",
                "language": "fr",
                "clock24Hours": True,
                "extra": True,
                "prefersIssueDetailsStreamlinedUI": True,
                "prefersStackedNavigation": True,
                "quickStartDisplay": {self.organization.id: 1},
            },
        )

        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == "hello world"
        # note: email should not change, removed support for email changing from this endpoint
        assert user.email == "a@example.com"
        assert user.username == "a@example.com"
        assert UserOption.objects.get_value(user=self.user, key="theme") == "system"
        assert UserOption.objects.get_value(user=self.user, key="default_issue_event") == "latest"
        assert UserOption.objects.get_value(user=self.user, key="timezone") == "UTC"
        assert UserOption.objects.get_value(user=self.user, key="stacktrace_order") == "2"
        assert UserOption.objects.get_value(user=self.user, key="language") == "fr"
        assert UserOption.objects.get_value(user=self.user, key="clock_24_hours")
        assert UserOption.objects.get_value(
            user=self.user, key="prefers_issue_details_streamlined_ui"
        )
        assert UserOption.objects.get_value(user=self.user, key="prefers_stacked_navigation")
        assert (
            UserOption.objects.get_value(user=self.user, key="quick_start_display").get(
                str(self.organization.id)
            )
            == 1
        )

        assert not UserOption.objects.get_value(user=self.user, key="extra")

    def test_saving_changes_value(self):
        """
        Even when saving on an option directly, we should still be able to use
        `get_value` to retrieve updated options.
        """
        UserOption.objects.set_value(user=self.user, key="language", value="fr")

        uo = UserOption.objects.get(user=self.user, key="language")
        uo.value = "en"
        uo.save()

        assert UserOption.objects.get_value(user=self.user, key="language") == "en"

    def test_managed_fields(self):
        assert self.user.name == "example name"
        with self.settings(SENTRY_MANAGED_USER_FIELDS=("name",)):
            self.get_success_response("me", name="new name")

            # name remains unchanged
            user = User.objects.get(id=self.user.id)
            assert user

    def test_change_username_when_different(self):
        # if email != username and we change username, only username should change
        user = self.create_user(email="c@example.com", username="diff@example.com")
        self.login_as(user=user, superuser=False)

        self.create_useremail(user, "new@example.com", is_verified=True)
        self.get_success_response("me", username="new@example.com")

        user = User.objects.get(id=user.id)

        assert user.email == "c@example.com"
        assert user.username == "new@example.com"

    def test_change_username_when_same(self):
        # if email == username and we change username,
        # keep email in sync
        user = self.create_user(email="c@example.com", username="c@example.com")
        self.login_as(user=user)

        self.create_useremail(user, "new@example.com", is_verified=True)
        self.get_success_response("me", username="new@example.com")

        user = User.objects.get(id=user.id)

        assert user.email == "new@example.com"
        assert user.username == "new@example.com"

    def test_cannot_change_username_to_non_verified(self):
        user = self.create_user(email="c@example.com", username="c@example.com")
        self.login_as(user=user)

        self.create_useremail(user, "new@example.com", is_verified=False)
        resp = self.get_error_response("me", username="new@example.com", status_code=400)
        assert resp.data["detail"] == "Verified email address is not found."

        user = User.objects.get(id=user.id)

        assert user.email == "c@example.com"
        assert user.username == "c@example.com"

    def test_saving_quick_start_display_option(self):
        org1_id = str(self.organization.id)
        org2_id = str(self.create_organization().id)

        # 1 = Shown once (on the second visit)
        self.get_success_response(
            "me",
            options={"quickStartDisplay": {org1_id: 1, org2_id: 2}},
        )
        assert (
            UserOption.objects.get_value(user=self.user, key="quick_start_display").get(org1_id)
            == 1
        )

        # 2 = Hidden automatically after the second visit
        self.get_success_response("me", options={"quickStartDisplay": {org1_id: 2}})
        assert (
            UserOption.objects.get_value(user=self.user, key="quick_start_display").get(org1_id)
            == 2
        )

        # Validate that existing other orgs entries are not affected
        assert (
            UserOption.objects.get_value(user=self.user, key="quick_start_display").get(org2_id)
            == 2
        )

        # Invalid values
        self.get_error_response(
            "me",
            options={"quickStartDisplay": {org1_id: None}},
            status_code=400,
        )

        self.get_error_response(
            "me",
            options={"quickStartDisplay": {org1_id: -1}},
            status_code=400,
        )

        self.get_error_response(
            "me",
            options={"quickStartDisplay": {org1_id: 0}},
            status_code=400,
        )

        self.get_error_response(
            "me",
            options={"quickStartDisplay": {org1_id: 3}},
            status_code=400,
        )

        self.get_error_response(
            "me",
            options={"quickStartDisplay": {org1_id: "invalid"}},
            status_code=400,
        )


@control_silo_test
class UserDetailsSuperuserUpdateTest(UserDetailsTest):
    method = "put"

    def test_superuser_can_change_is_active(self):
        self.user.update(is_active=True)
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_superuser_with_permission_can_change_is_active(self):
        self.user.update(is_active=True)
        UserPermission.objects.create(user=self.superuser, permission="users.admin")
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_cannot_change_is_active(self):
        self.user.update(is_active=True)
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        self.get_error_response(
            self.user.id,
            isActive="false",
            status_code=403,
        )

        self.user.refresh_from_db()
        assert self.user.is_active

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_write_can_change_is_active(self):
        self.user.update(is_active=True)
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.add_user_permission(superuser, "superuser.write")
        self.login_as(user=superuser, superuser=True)

        resp = self.get_success_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        self.user.refresh_from_db()
        assert not self.user.is_active

    def test_superuser_cannot_add_superuser(self):
        self.user.update(is_superuser=False)
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_error_response(
            self.user.id,
            isSuperuser="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add superuser."

        user = User.objects.get(id=self.user.id)
        assert not user.is_superuser

    def test_superuser_cannot_add_staff(self):
        self.user.update(is_staff=False)
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_error_response(
            self.user.id,
            isStaff="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add admin."

        user = User.objects.get(id=self.user.id)
        assert not user.is_staff

    def test_superuser_with_permission_can_add_superuser(self):
        self.user.update(is_superuser=False)
        UserPermission.objects.create(user=self.superuser, permission="users.admin")
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(
            self.user.id,
            isSuperuser="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_superuser

    def test_superuser_with_permission_can_add_staff(self):
        self.user.update(is_staff=False)
        UserPermission.objects.create(user=self.superuser, permission="users.admin")
        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_success_response(
            self.user.id,
            isStaff="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_staff


@control_silo_test
class UserDetailsStaffUpdateTest(UserDetailsTest):
    method = "put"

    @fixture(autouse=True)
    def _activate_staff_mode(self):
        with override_options({"staff.ga-rollout": True}):
            yield

    def test_staff_can_change_is_active(self):
        self.user.update(is_active=True)
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_staff_with_permission_can_change_is_active(self):
        self.user.update(is_active=True)
        UserPermission.objects.create(user=self.staff_user, permission="users.admin")
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_staff_cannot_add_superuser(self):
        self.user.update(is_superuser=False)
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_error_response(
            self.user.id,
            isSuperuser="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add superuser."

        user = User.objects.get(id=self.user.id)
        assert not user.is_superuser

    def test_staff_cannot_add_staff(self):
        self.user.update(is_staff=False)

        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_error_response(
            self.user.id,
            isStaff="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add admin."

        user = User.objects.get(id=self.user.id)
        assert not user.is_staff

    def test_superuser_cannot_add_superuser_or_staff_with_feature_flag(self):
        self.user.update(is_staff=False)

        self.login_as(user=self.superuser, superuser=True)

        resp = self.get_error_response(
            self.user.id,
            isStaff="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add admin."

        resp = self.get_error_response(
            self.user.id,
            isSuperuser="true",
            status_code=403,
        )
        assert resp.data["detail"] == "Missing required permission to add superuser."

        user = User.objects.get(id=self.user.id)
        assert not user.is_staff
        assert not user.is_superuser

    def test_staff_with_permission_can_add_superuser(self):
        self.user.update(is_superuser=False)

        UserPermission.objects.create(user=self.staff_user, permission="users.admin")
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(
            self.user.id,
            isSuperuser="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_superuser

    def test_staff_with_permission_can_add_staff(self):
        self.user.update(is_staff=False)

        UserPermission.objects.create(user=self.staff_user, permission="users.admin")
        self.login_as(user=self.staff_user, staff=True)

        resp = self.get_success_response(
            self.user.id,
            isStaff="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_staff


@control_silo_test
class UserDetailsDeleteTest(UserDetailsTest, HybridCloudTestMixin):
    method = "delete"

    def test_close_account(self):
        org_single_owner = self.create_organization(name="A", owner=self.user)
        user2 = self.create_user(email="user2@example.com")
        org_with_other_owner = self.create_organization(name="B", owner=self.user)
        org_as_other_owner = self.create_organization(name="C", owner=user2)
        not_owned_org = self.create_organization(name="D", owner=user2)

        self.create_member(user=user2, organization=org_with_other_owner, role="owner")
        self.create_member(user=self.user, organization=org_as_other_owner, role="owner")

        # test validations
        self.get_error_response(self.user.id, status_code=400)
        self.get_error_response(self.user.id, organizations=None, status_code=400)

        with assume_test_silo_mode(SiloMode.REGION):
            assert DeletedOrganization.objects.count() == 0

        # test actual delete
        self.get_success_response(
            self.user.id,
            organizations=[
                org_with_other_owner.slug,
                org_as_other_owner.slug,
                not_owned_org.slug,
            ],
            status_code=204,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            # deletes org_single_owner even though it wasn't specified in array
            # because it has a single owner
            assert (
                Organization.objects.get(id=org_single_owner.id).status
                == OrganizationStatus.PENDING_DELETION
            )
            # should delete org_with_other_owner, and org_as_other_owner
            assert (
                Organization.objects.get(id=org_with_other_owner.id).status
                == OrganizationStatus.PENDING_DELETION
            )
            assert (
                Organization.objects.get(id=org_as_other_owner.id).status
                == OrganizationStatus.PENDING_DELETION
            )
            # should NOT delete `not_owned_org`
            assert Organization.objects.get(id=not_owned_org.id).status == OrganizationStatus.ACTIVE
            assert DeletedOrganization.objects.count() == 3

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_close_account_no_orgs(self):
        org_single_owner = self.create_organization(name="A", owner=self.user)
        user2 = self.create_user(email="user2@example.com")
        org_with_other_owner = self.create_organization(name="B", owner=self.user)
        org_as_other_owner = self.create_organization(name="C", owner=user2)
        not_owned_org = self.create_organization(name="D", owner=user2)

        self.create_member(user=user2, organization=org_with_other_owner, role="owner")
        self.create_member(user=self.user, organization=org_as_other_owner, role="owner")

        with assume_test_silo_mode(SiloMode.REGION):
            member_records = list(
                OrganizationMember.objects.filter(
                    organization__in=[org_with_other_owner.id, org_as_other_owner.id],
                    user_id=self.user.id,
                )
            )
            assert DeletedOrganization.objects.count() == 0

        for member in member_records:
            self.assert_org_member_mapping(org_member=member)

        with self.tasks(), outbox_runner():
            self.get_success_response(self.user.id, organizations=[], status_code=204)

        # Assume monolith silo mode to ensure all tasks are run correctly
        with self.tasks(), assume_test_silo_mode(SiloMode.MONOLITH):
            schedule_hybrid_cloud_foreign_key_jobs()

        for member in member_records:
            self.assert_org_member_mapping_not_exists(org_member=member)

        with assume_test_silo_mode(SiloMode.REGION):
            # deletes org_single_owner even though it wasn't specified in array
            # because it has a single owner
            assert (
                Organization.objects.get(id=org_single_owner.id).status
                == OrganizationStatus.PENDING_DELETION
            )
            # should NOT delete `not_owned_org`
            assert Organization.objects.get(id=not_owned_org.id).status == OrganizationStatus.ACTIVE
            assert DeletedOrganization.objects.count() == 1

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_cannot_hard_delete_self(self):
        # Cannot hard delete your own account
        self.get_error_response(self.user.id, hardDelete=True, organizations=[], status_code=403)

    def test_superuser_hard_delete_account_without_permission(self):
        self.login_as(user=self.superuser, superuser=True)
        user2 = self.create_user(email="user2@example.com")

        # failed authorization, user does not have users.admin permission to hard delete another user
        response = self.get_error_response(
            user2.id, hardDelete=True, organizations=[], status_code=403
        )

        assert response.data["detail"] == "Missing required permission to hard delete account."
        assert User.objects.filter(id=user2.id).exists()

    @override_options({"staff.ga-rollout": True})
    def test_staff_hard_delete_account_without_permission(self):
        self.login_as(user=self.staff_user, staff=True)
        user2 = self.create_user(email="user2@example.com")

        # failed authorization, user does not have users.admin permission to hard delete another user
        response = self.get_error_response(
            user2.id, hardDelete=True, organizations=[], status_code=403
        )

        assert response.data["detail"] == "Missing required permission to hard delete account."
        assert User.objects.filter(id=user2.id).exists()

    def test_superuser_hard_delete_account_with_permission(self):
        self.login_as(user=self.superuser, superuser=True)
        user2 = self.create_user(email="user2@example.com")

        # Add users.admin permission to superuser
        UserPermission.objects.create(user=self.superuser, permission="users.admin")

        self.get_success_response(user2.id, hardDelete=True, organizations=[], status_code=204)
        assert not User.objects.filter(id=user2.id).exists()

    @override_options({"staff.ga-rollout": True})
    def test_staff_hard_delete_account_with_permission(self):
        self.login_as(user=self.staff_user, staff=True)
        user2 = self.create_user(email="user2@example.com")

        # Add users.admin permission to staff
        UserPermission.objects.create(user=self.staff_user, permission="users.admin")

        self.get_success_response(user2.id, hardDelete=True, organizations=[], status_code=204)
        assert not User.objects.filter(id=user2.id).exists()

    @override_options({"staff.ga-rollout": True})
    def test_superuser_cannot_hard_delete_with_active_option(self):
        self.login_as(user=self.superuser, superuser=True)
        user2 = self.create_user(email="user2@example.com")

        # Add users.admin permission to superuser
        UserPermission.objects.create(user=self.superuser, permission="users.admin")

        # Superusers will eventually be prevented from hard deleting accounts
        # once the feature flag is removed
        response = self.get_error_response(
            user2.id, hardDelete=True, organizations=[], status_code=403
        )

        assert response.data["detail"] == "Missing required permission to hard delete account."
        assert User.objects.filter(id=user2.id).exists()
