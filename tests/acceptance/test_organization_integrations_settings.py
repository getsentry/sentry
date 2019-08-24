from __future__ import absolute_import

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase
from tests.sentry.plugins.testutils import register_mock_plugins, unregister_mock_plugins


class OrganizationIntegrationSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.model = Integration.objects.create(
            provider="slack",
            external_id="some_slack",
            name="Test Slack",
            metadata={"domain_name": "slack-test.slack.com"},
        )

        self.org_integration = self.model.add_organization(self.org, self.user)

        register_mock_plugins()
        self.login_as(self.user)

    def tearDown(self):
        unregister_mock_plugins()

    def test_all_integrations_list(self):
        path = u"/settings/{}/integrations/".format(self.org.slug)
        self.browser.get(path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("organization settings - all integrations")
