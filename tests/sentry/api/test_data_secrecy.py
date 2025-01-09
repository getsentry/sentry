from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature


class SuperuserDataSecrecyTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-details"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @with_feature("organizations:enterprise-data-secrecy")
    def test_superuser_no_access(self):
        """
        Please contact the Enterprise team if your code change causes this test to fail
        """
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser cannot access orgs with data secrecy
        self.get_error_response(self.organization.slug, status_code=401)

    def test_superuser_has_access(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser can access orgs without data secrecy
        self.get_success_response(self.organization.slug)

    def test_non_member_no_access(self):
        self.login_as(self.create_user())
        self.get_error_response(self.organization.slug, status_code=403)

    def test_member_has_access(self):
        self.get_success_response(self.organization.slug)


class DataSecrecyV2TestCase(APITestCase):
    # Picked an endpoint with OrganizationAndStaffPermission
    endpoint = "sentry-api-0-organization-projects"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.organization.flags.prevent_superuser_access = True
        self.organization.save()

    @with_feature("organizations:data-secrecy")
    def test_superuser_no_access(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser cannot access orgs with data secrecy
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=401)

    @with_feature("organizations:data-secrecy")
    def test_superuser_has_access(self):
        self.organization.flags.prevent_superuser_access = False
        self.organization.save()
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        # superuser can access orgs without data secrecy
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)

    def test_non_member_no_access(self):
        self.login_as(self.create_user())
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=403)

    def test_member_has_access(self):
        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)

    @with_feature("organizations:data-secrecy")
    @override_options({"staff.ga-rollout": True})
    def test_admin_access_when_superuser_no_access(self):
        # When the superuser has no access, the admin should also still work
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_error_response(self.organization.slug, status_code=401)

        admin = self.create_user(is_staff=True)
        self.login_as(admin, staff=True)

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(self.organization.slug)
