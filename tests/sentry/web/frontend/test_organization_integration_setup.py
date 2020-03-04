from __future__ import absolute_import

import pytest

from sentry.testutils import PermissionTestCase, TestCase


class OrganizationIntegrationSetupPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationIntegrationSetupPermissionTest, self).setUp()
        self.path = u"/organizations/{}/integrations/example/setup/".format(self.organization.slug)

    # this currently redirects the user
    @pytest.mark.xfail
    def test_manager_can_load(self):
        self.assert_role_can_access(self.path, "manager")

    # this currently redirects the user
    @pytest.mark.xfail
    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class OrganizationIntegrationSetupTest(TestCase):
    def setUp(self):
        super(OrganizationIntegrationSetupTest, self).setUp()
        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)
        self.path = u"/organizations/{}/integrations/example/setup/".format(self.organization.slug)

    def test_basic_flow(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200

        resp = self.client.post(self.path, data={"name": "morty"})
        assert resp.status_code == 200

        # Check that we're binding the state back to the opening window
        # through the dialog's window.postMessage.
        assert b"morty" in resp.content
