import pytest

from sentry.api.exceptions import DataSecrecyError
from sentry.auth import access
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature


class DataSecrecyTestCase(APITestCase):
    # Picked an endpoint with OrganizationAndStaffPermission
    endpoint = "sentry-api-0-organization-projects"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.organization.flags.prevent_superuser_access = True
        self.organization.save()

    @with_feature("organizations:data-secrecy")
    def test_superuser_no_access(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser cannot access orgs with data secrecy
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=401)

    @with_feature("organizations:data-secrecy")
    def test_superuser_has_access(self) -> None:
        self.organization.flags.prevent_superuser_access = False
        self.organization.save()
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser can access orgs without data secrecy
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)

    def test_non_member_no_access(self) -> None:
        self.login_as(self.create_user())
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=403)

    def test_member_has_access(self) -> None:
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)

    @with_feature("organizations:data-secrecy")
    @override_options({"staff.ga-rollout": True})
    def test_admin_access_when_superuser_no_access(self) -> None:
        # When the superuser has no access, the admin should also still work
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=401)

        admin = self.create_user(is_staff=True)
        self.login_as(admin, staff=True)

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)


class ImpersonationDataSecrecyTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.owner = self.create_user()
        self.organization.flags.prevent_superuser_access = True
        self.organization.save()
        self.create_member(organization=self.organization, user=self.owner, role="owner")

    def _build_impersonated_request(self, impersonated_user):
        request = self.make_request(user=impersonated_user)
        request.actual_user = self.superuser  # type: ignore[attr-defined]
        return request

    def _from_request_org_and_scopes(self, request):
        rpc_user_org_context = organization_service.get_organization_by_id(
            id=self.organization.id, user_id=request.user.id
        )
        return access.from_request_org_and_scopes(
            request=request, rpc_user_org_context=rpc_user_org_context
        )

    @with_feature("organizations:data-secrecy")
    def test_impersonated_blocked_from_data_secrecy_org(self) -> None:
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            with pytest.raises(DataSecrecyError):
                self._from_request_org_and_scopes(request)

    @with_feature("organizations:data-secrecy")
    def test_impersonated_allowed_when_org_has_no_data_secrecy(self) -> None:
        self.organization.flags.prevent_superuser_access = False
        self.organization.save()
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            result = self._from_request_org_and_scopes(request)
            assert result is not None

    @with_feature("organizations:data-secrecy")
    def test_non_impersonated_member_unaffected(self) -> None:
        request = self.make_request(user=self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            result = self._from_request_org_and_scopes(request)
            assert result is not None

    def test_impersonated_allowed_when_feature_disabled(self) -> None:
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            result = self._from_request_org_and_scopes(request)
            assert result is not None

    @with_feature("organizations:data-secrecy")
    def test_impersonated_allowed_on_self_hosted(self) -> None:
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=True):
            result = self._from_request_org_and_scopes(request)
            assert result is not None

    @with_feature("organizations:data-secrecy")
    def test_impersonated_blocked_via_from_request_db_path(self) -> None:
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            with pytest.raises(DataSecrecyError):
                access.from_request(request, self.organization)

    @with_feature("organizations:data-secrecy")
    def test_impersonated_allowed_via_from_request_db_path_no_data_secrecy(self) -> None:
        self.organization.flags.prevent_superuser_access = False
        self.organization.save()
        request = self._build_impersonated_request(self.owner)
        with self.settings(SENTRY_SELF_HOSTED=False):
            result = access.from_request(request, self.organization)
            assert result is not None
