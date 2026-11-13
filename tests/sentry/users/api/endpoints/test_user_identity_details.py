from django.test import override_settings

from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class DeleteUserIdentityTest(APITestCase):
    endpoint = "sentry-api-0-user-identity-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        auth_provider = AuthProvider.objects.create(
            organization_id=self.organization.id, provider="dummy"
        )
        self.auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            ident=self.user.email,
            user=self.user,
        )

    def test_simple(self) -> None:
        self.login_as(self.user)

        self.get_success_response(self.user.id, self.auth_identity.id, status_code=204)

        assert not AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    def test_other_user_cannot_delete(self) -> None:
        self.login_as(self.create_user())

        self.get_error_response(self.user.id, self.auth_identity.id, status_code=403)

        assert AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    def test_staff_with_superuser_write_can_delete(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.add_user_permission(staff_user, "superuser.write")
        self.login_as(staff_user, staff=True)

        self.get_success_response(self.user.id, self.auth_identity.id, status_code=204)

        assert not AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    def test_staff_without_superuser_write_cannot_delete(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(staff_user, staff=True)

        self.get_error_response(self.user.id, self.auth_identity.id, status_code=403)

        assert AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    def test_inactive_staff_with_superuser_write_cannot_delete(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.add_user_permission(staff_user, "superuser.write")
        self.login_as(staff_user)

        self.get_error_response(self.user.id, self.auth_identity.id, status_code=403)

        assert AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_with_superuser_write_can_delete(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.add_user_permission(superuser, "superuser.write")
        self.login_as(superuser, superuser=True)

        self.get_success_response(self.user.id, self.auth_identity.id, status_code=204)

        assert not AuthIdentity.objects.filter(id=self.auth_identity.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_cannot_delete(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        self.get_error_response(self.user.id, self.auth_identity.id, status_code=403)

        assert AuthIdentity.objects.filter(id=self.auth_identity.id).exists()
