import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import IntegrationRow from 'sentry/views/organizationIntegrations/integrationRow';

describe('IntegrationRow', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  const org = TestStubs.Organization();

  describe('SentryApp', function () {
    it('is an internal SentryApp', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="my-headband-washer-289499"
          displayName="My Headband Washer"
          status="Installed"
          publishStatus="internal"
          configurations={0}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual(
        'my-headband-washer-289499'
      );
      expect(wrapper.find('IntegrationName').props().children).toEqual(
        'My Headband Washer'
      );
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/developer-settings/my-headband-washer-289499/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('PublishStatus').props().status).toEqual('internal');
    });

    it('is a published SentryApp', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="clickup"
          displayName="ClickUp"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('clickup');
      expect(wrapper.find('IntegrationName').props().children).toEqual('ClickUp');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/sentry-apps/clickup/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
    });
  });
  describe('First Party Integration', function () {
    it('has been installed (1 configuration)', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={1}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('bitbucket');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Bitbucket');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').props().children).toEqual('1 Configuration');
    });

    it('has been installed (3 configurations)', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={3}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('bitbucket');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Bitbucket');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').props().children).toEqual('3 Configurations');
    });

    it('has not been installed', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="github"
          displayName="Github"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('github');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Github');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/integrations/github/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').exists()).toEqual(false);
    });
  });
  describe('Plugin', function () {
    it('has been installed (1 project)', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="twilio"
          displayName="Twilio (SMS) "
          status="Installed"
          publishStatus="published"
          configurations={1}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('twilio');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Twilio (SMS) ');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/plugins/twilio/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').props().children).toEqual('1 Configuration');
    });

    it('has been installed (3 projects)', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="twilio"
          displayName="Twilio (SMS) "
          status="Installed"
          publishStatus="published"
          configurations={3}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('twilio');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Twilio (SMS) ');
      expect(wrapper.find('IntegrationName').props().to).toEqual(
        `/settings/${org.slug}/plugins/twilio/`
      );
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').props().children).toEqual('3 Configurations');
    });

    it('has not been installed', async function () {
      const wrapper = mountWithTheme(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="amazon-sqs"
          displayName="Amazon SQS"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          data-test-id="integration-row"
        />
      );
      expect(wrapper.find('PluginIcon').props().pluginId).toEqual('amazon-sqs');
      expect(wrapper.find('IntegrationName').props().children).toEqual('Amazon SQS');
      expect(wrapper.find('IntegrationStatus').props().status).toEqual('Not Installed');
      expect(wrapper.find('PublishStatus').exists()).toEqual(false);
      expect(wrapper.find('StyledLink').exists()).toEqual(false);
    });
  });
});
