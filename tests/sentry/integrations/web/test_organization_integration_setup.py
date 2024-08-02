import pytest

from sentry.testutils.cases import PermissionTestCase, TestCase
from sentry.testutils.helpers.features import with_feature
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

    @with_feature(
        {
            "organizations:integrations-issue-basic": True,
            "organizations:integrations-stacktrace-link": True,
        }
    )
    def test_allow_integration_with_all_features_enabled(self):
        self.test_basic_flow()

    @with_feature(
        {
            "organizations:integrations-issue-basic": True,
            "organizations:integrations-stacktrace-link": False,
        }
    )
    def test_allow_integration_with_one_feature_enabled(self):
        self.test_basic_flow()

    @with_feature(
        {
            "organizations:integrations-issue-basic": False,
            "organizations:integrations-stacktrace-link": False,
        }
    )
    def test_allow_integration_with_all_features_disabled_but_one_unregistered(self):
        # `example`` integration also has "organizations:integrations-commits" feature
        # but it is not registered in the SENTRY_FEATURES so we allow the integration.
        self.test_basic_flow()

    @with_feature(
        {
            "organizations:integrations-alert-rule": False,
            "organizations:integrations-chat-unfurl": False,
        }
    )
    def test_disallow_integration_with_all_features_disabled(self):
        self.path = f"/organizations/{self.organization.slug}/integrations/slack/setup/"
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert (
            b"At least one feature from this list has to be enabled in order to setup the integration"
            in resp.content
        )
