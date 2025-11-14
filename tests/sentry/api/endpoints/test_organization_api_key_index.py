from typing import int
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationApiKeyIndex(APITestCase):
    endpoint = "sentry-api-0-organization-api-key-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_org_admin_can_access(self) -> None:
        self.get_success_response(self.organization.slug)

    def test_member_no_access(self) -> None:
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, user=user, role="member")

        self.login_as(user)
        self.get_error_response(self.organization.slug, status_code=403)

    def test_superuser_can_access(self) -> None:
        admin_user = self.create_user("admin@example.com", is_superuser=True)
        self.create_member(organization=self.organization, user=admin_user, role="admin")

        self.login_as(admin_user, superuser=True)
        self.get_success_response(self.organization.slug)
