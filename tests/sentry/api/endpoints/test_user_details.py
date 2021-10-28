from sentry.models import Organization, OrganizationStatus, User, UserOption, UserPermission
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="a@example.com", is_managed=False, name="example name")
        self.login_as(user=self.user)


class UserDetailsGetTest(UserDetailsTest):
    # TODO(dcramer): theres currently no way to look up other users
    def test_look_up_other_user(self):
        user2 = self.create_user(email="b@example.com")
        self.get_valid_response(user2.id, status_code=403)

    def test_lookup_self(self):
        resp = self.get_valid_response("me")

        assert resp.data["id"] == str(self.user.id)
        assert resp.data["options"]["theme"] == "light"
        assert resp.data["options"]["timezone"] == "UTC"
        assert resp.data["options"]["language"] == "en"
        assert resp.data["options"]["stacktraceOrder"] == -1
        assert not resp.data["options"]["clock24Hours"]

    def test_superuser(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(self.user.id)

        assert resp.data["id"] == str(self.user.id)
        assert "identities" in resp.data
        assert len(resp.data["identities"]) == 0


class UserDetailsUpdateTest(UserDetailsTest):
    method = "put"

    def test_simple(self):
        resp = self.get_valid_response(
            "me",
            name="hello world",
            options={
                "theme": "system",
                "timezone": "UTC",
                "stacktraceOrder": "2",
                "language": "fr",
                "clock24Hours": True,
                "extra": True,
            },
        )

        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == "hello world"
        # note: email should not change, removed support for email changing from this endpoint
        assert user.email == "a@example.com"
        assert user.username == "a@example.com"
        assert UserOption.objects.get_value(user=self.user, key="theme") == "system"
        assert UserOption.objects.get_value(user=self.user, key="timezone") == "UTC"
        assert UserOption.objects.get_value(user=self.user, key="stacktrace_order") == "2"
        assert UserOption.objects.get_value(user=self.user, key="language") == "fr"
        assert UserOption.objects.get_value(user=self.user, key="clock_24_hours")
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
            self.get_valid_response("me", name="new name")

            # name remains unchanged
            user = User.objects.get(id=self.user.id)
            assert user

    def test_change_username_when_different(self):
        # if email != username and we change username, only username should change
        user = self.create_user(email="c@example.com", username="diff@example.com")
        self.login_as(user=user, superuser=False)

        self.get_valid_response("me", username="new@example.com")

        user = User.objects.get(id=user.id)

        assert user.email == "c@example.com"
        assert user.username == "new@example.com"

    def test_change_username_when_same(self):
        # if email == username and we change username,
        # keep email in sync
        user = self.create_user(email="c@example.com", username="c@example.com")
        self.login_as(user=user)

        self.get_valid_response("me", username="new@example.com")

        user = User.objects.get(id=user.id)

        assert user.email == "new@example.com"
        assert user.username == "new@example.com"


class UserDetailsSuperuserUpdateTest(UserDetailsTest):
    method = "put"

    def test_superuser_cannot_change_is_active(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_active

    def test_superuser_with_permission_can_change_is_active(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        UserPermission.objects.create(user=superuser, permission="users.admin")
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isActive="false",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_superuser_cannot_add_superuser(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isSuperuser="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_superuser

    def test_superuser_cannot_add_staff(self):
        self.user.update(is_staff=False)
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isStaff="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert not user.is_staff

    def test_superuser_with_permission_can_add_superuser(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        UserPermission.objects.create(user=superuser, permission="users.admin")
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isSuperuser="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_superuser

    def test_superuser_with_permission_can_add_staff(self):
        superuser = self.create_user(email="b@example.com", is_superuser=True)
        UserPermission.objects.create(user=superuser, permission="users.admin")
        self.login_as(user=superuser, superuser=True)

        resp = self.get_valid_response(
            self.user.id,
            isStaff="true",
        )
        assert resp.data["id"] == str(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.is_staff


class UserDetailsDeleteTest(UserDetailsTest):
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
        self.get_valid_response(self.user.id, status_code=400)
        self.get_valid_response(self.user.id, organizations=None, status_code=400)

        # test actual delete
        self.get_valid_response(
            self.user.id,
            organizations=[
                org_with_other_owner.slug,
                org_as_other_owner.slug,
                not_owned_org.slug,
            ],
            status_code=204,
        )

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

        self.get_valid_response(self.user.id, organizations=[], status_code=204)

        # deletes org_single_owner even though it wasn't specified in array
        # because it has a single owner
        assert (
            Organization.objects.get(id=org_single_owner.id).status
            == OrganizationStatus.PENDING_DELETION
        )
        # should NOT delete `not_owned_org`
        assert Organization.objects.get(id=not_owned_org.id).status == OrganizationStatus.ACTIVE

        user = User.objects.get(id=self.user.id)
        assert not user.is_active

    def test_cannot_hard_delete_self(self):
        # Cannot hard delete your own account
        self.get_valid_response(self.user.id, hardDelete=True, organizations=[], status_code=403)

    def test_hard_delete_account_without_permission(self):
        self.user.update(is_superuser=True)
        user2 = self.create_user(email="user2@example.com")

        # failed authorization, user does not have permissions to delete another user
        self.get_valid_response(user2.id, hardDelete=True, organizations=[], status_code=403)

        # Reauthenticate as super user to hard delete an account
        self.login_as(user=self.user, superuser=True)

        self.get_valid_response(user2.id, hardDelete=True, organizations=[], status_code=403)

        assert User.objects.filter(id=user2.id).exists()

    def test_hard_delete_account_with_permission(self):
        self.user.update(is_superuser=True)
        user2 = self.create_user(email="user2@example.com")

        # failed authorization, user does not have permissions to delete another user
        self.get_valid_response(user2.id, hardDelete=True, organizations=[], status_code=403)

        # Reauthenticate as super user to hard delete an account
        UserPermission.objects.create(user=self.user, permission="users.admin")
        self.login_as(user=self.user, superuser=True)

        self.get_valid_response(user2.id, hardDelete=True, organizations=[], status_code=204)

        assert not User.objects.filter(id=user2.id).exists()
