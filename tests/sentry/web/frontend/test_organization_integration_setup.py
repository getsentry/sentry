import pytest

from sentry.testutils.cases import PermissionTestCase, TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationSetupPermissionTest(PermissionTestCase):
    def setUp(self):
        super().setUp()
        self.path = f"/organizations/{self.organization.slug}/integrations/example/setup/"

    # this currently redirects the user
    @pytest.mark.xfail
    def test_manager_can_load(self):
        self.assert_role_can_access(self.path, "manager")

    # this currently redirects the user
    @pytest.mark.xfail
    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


@control_silo_test
class OrganizationIntegrationSetupTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/integrations/example/setup/"

    def test_basic_flow(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200

        resp = self.client.post(self.path, data={"name": "morty"})
        assert resp.status_code == 200

        # Check that we're binding the state back to the opening window
        # through the dialog's window.postMessage.
        assert b"morty" in resp.content
