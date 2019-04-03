from __future__ import absolute_import


from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase
from tests.acceptance.testutils import ExampleProviderElement, OrganizationIntegrationSettingsPage


class OrganizationIntegrationAcceptanceTestCase(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationAcceptanceTestCase, self).setUp()
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
            provider='example',
            external_id='example',
            name='Test Integration',
            metadata={
                'domain_name': 'example-test.com',
            },
        )
        self.org_integration = self.model.add_organization(self.org, self.user)
        self.login_as(self.user)

        self.integration_settings_path = 'sentry-api-0-organization-integrations'
        self.issue_details_path = ''
        self.issue_stream_path = ''

    def create_user_with_role(self, role, organization=None, teams=None):
        """
        Owner, manager, admin
        """
        user = self.create_user()
        self.create_member(
            organization=organization if organization else self.organization,
            user=user,
            role=role,
            teams=teams if teams else [],
        )
        return user


class OrganizationIntegrationSettingsTest(OrganizationIntegrationAcceptanceTestCase):
    """
    As a user(type?), I can setup, configure, and remove an integration.
    """

    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.browser.get(u'/settings/{}/integrations/'.format(self.organization.slug))
        self.browser.wait_until_not('.loading-indicator')
        self.page = OrganizationIntegrationSettingsPage(self.browser)
        self.provider_key = 'example'

    def assert_can_setup_integration(self):
        """
        - Add information to setup steps and succefully add new integration
        """
        provider_element = ExampleProviderElement({'name': 'Example Installation'})
        self.page.create_new_installation(provider_element)

    def test_add_multiple_integrations_to_one_provider(self):
        pass

    def test_setup_new_integration_with_repository(self):
        """
        - Add information to a setup steps and succefully add new integration
        - Configure the integration by adding a repository
        - View that repository in list of repositories
        - View integration in Linked Issues section
        """
        self.assert_can_setup_integration()

    def test_setup_new_integration_with_issue_sync(self):
        """
        - Add information to a setup steps and succefully add new integration
        - Configure the Integration by adding sync settings
        - View integration in Linked Issues section
        """

    def test_remove_existing_integration(self):
        pass

    def test_update_legacy_integration(self):
        pass

    def test_user_permissions_for_integration_settings(self):
        """
        Different types of users see different things...
        not sure what that is but this test is for that
        """
        pass


class OrganizationIntegrationIssuesTest(OrganizationIntegrationAcceptanceTestCase):

    def test_user_can_create_external_issue_from_sentry_issue(self):
        """
        - View integration in Linked Issues section
        - Default fields filled in
        - Default project filled in
        - Fill in missing information on create form
        - Create issue successfully
        - view log in comments
        - (I think) view linked issue in issue stream
         ** missing testing issue sync in some way
        """
        pass

    def test_user_can_link_external_issue_to_sentry_issue(self):
        """
        - View integration in Linked Issues section
        -
        ** note integrations with repos tend to have a more complex issue link form
        """
        pass
