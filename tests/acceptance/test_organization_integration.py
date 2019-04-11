from __future__ import absolute_import

from exam import mock

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase
from tests.acceptance.page_objects.organization_integration_settings import (
    OrganizationIntegrationSettingsPage, ExampleIntegrationSetupWindowElement
)


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

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not('.loading-indicator')

    def assert_button_element(self, button, label, disabled=False, icon=None):
        disabled = 'true' if disabled else 'false'
        assert button.get_disabled() == disabled
        assert button.get_label() == label
        if icon:
            assert button.get_icon_href() == icon


class OrganizationIntegrationSettingsTest(OrganizationIntegrationAcceptanceTestCase):
    """
    As a user(type?), I can setup, configure, and remove an integration.
    """
    # TODO(lb): Tests to be written
    # test_setup_new_integration_with_repository
    # test_setup_new_integration_with_issue_sync
    # test_remove_existing_integration_installation
    # test_update_legacy_integration
    # test_user_permissions_for_integration_settings
    # test_add_multiple_integrations_to_one_provider

    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.org_integration_settings_path = u'/settings/{}/integrations/'.format(
            self.organization.slug)

        self.provider = mock.Mock()
        self.provider.key = 'example'
        self.provider.name = 'Example Installation'

    def assert_can_create_new_installation(self):
        self.load_page(self.org_integration_settings_path)
        org_settings_page = OrganizationIntegrationSettingsPage(
            browser=self.browser
        )
        provider_element = org_settings_page.get_provider(self.provider)

        integration_details_modal = org_settings_page.click_install_button(provider_element)
        integration_details_modal.add_button.click()
        org_settings_page.click_through_integration_setup(
            integration_details_modal,
            ExampleIntegrationSetupWindowElement,
            {'name': self.provider.name}
        )

        installation_element = provider_element.get_installation_with_name(self.provider.name)
        assert installation_element
        assert Integration.objects.filter(
            provider=self.provider.key,
            external_id=self.provider.name
        ).exists()

        # TODO(lb): check issues details page and see that integration shows in linked issues
        return installation_element

    def assert_has_installation_button(self, provider_row_element):
        self.assert_button_element(
            button=provider_row_element.install_button,
            label='Install',
            disabled=False,
            icon='#icon-circle-add'
        )

    def assert_installation_element(self, installation_element):
        self.assert_button_element(
            button=installation_element.configure_button,
            icon='#icon-settings',
            label='Configure',
            disabled=False,
        )
        self.assert_button_element(
            button=installation_element.remove_button,
            icon='#icon-trash',
            label='Remove',
            disabled=False,
        )

    def assert_installation_details_modal(self, installation_modal):
        self.assert_button_element(
            button=installation_modal.cancel_button,
            label='Cancel'
        )
        self.assert_button_element(
            button=installation_modal.add_button,
            label='Add %s' % self.provider.key,
        )
        assert installation_modal.title == '%s Integration' % self.provider.key

    def test_can_create_new_integration(self):
        self.assert_can_create_new_installation()
