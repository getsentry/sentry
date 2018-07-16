from __future__ import absolute_import

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase


class OrganizationIntegrationSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.model = Integration.objects.create(
            provider='slack',
            external_id='some_slack',
            name='Test Slack',
            metadata={
                'domain_name': 'slack-test.slack.com',
            },
        )

        self.org_integration = self.model.add_organization(self.org.id)

        self.login_as(self.user)

    def test_all_integrations_list(self):
        path = '/settings/{}/integrations/'.format(self.org.slug)
        self.browser.get(path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('organization settings - all integrations')
