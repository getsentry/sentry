import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationRow from 'sentry/views/settings/organizationIntegrations/integrationRow';

describe('IntegrationRow', function () {
  const {organization: org, routerContext} = initializeOrg();

  describe('SentryApp', function () {
    it('is an internal SentryApp', function () {
      render(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="my-headband-washer-289499"
          displayName="My Headband Washer"
          status="Installed"
          publishStatus="internal"
          configurations={0}
          categories={[]}
        />
      );
      expect(screen.getByText('My Headband Washer')).toBeInTheDocument();
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('internal')).toBeInTheDocument();
    });

    it('is a published SentryApp', function () {
      render(
        <IntegrationRow
          organization={org}
          type="sentryApp"
          slug="clickup"
          displayName="ClickUp"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('ClickUp')).toBeInTheDocument();
      expect(screen.getByText('ClickUp')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/sentry-apps/clickup/`
      );
      expect(screen.getByText('Not Installed')).toBeInTheDocument();
    });
  });
  describe('First Party Integration', function () {
    it('has been installed (1 configuration)', function () {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={1}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('Bitbucket')).toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(screen.getByText('1 Configuration')).toBeInTheDocument();
    });

    it('has been installed (3 configurations)', function () {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="bitbucket"
          displayName="Bitbucket"
          status="Installed"
          publishStatus="published"
          configurations={3}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/bitbucket/`
      );
      expect(screen.getByText('3 Configurations')).toBeInTheDocument();
    });

    it('has not been installed', function () {
      render(
        <IntegrationRow
          organization={org}
          type="firstParty"
          slug="github"
          displayName="Github"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('Not Installed')).toBeInTheDocument();
      expect(screen.getByText('Github')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/integrations/github/`
      );
    });
  });
  describe('Plugin', function () {
    it('has been installed (1 project)', function () {
      render(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="twilio"
          displayName="Twilio (SMS) "
          status="Installed"
          publishStatus="published"
          configurations={1}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('1 Configuration')).toBeInTheDocument();
      expect(screen.getByText('Twilio (SMS)')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/plugins/twilio/`
      );
    });

    it('has been installed (3 projects)', function () {
      render(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="twilio"
          displayName="Twilio (SMS) "
          status="Installed"
          publishStatus="published"
          configurations={3}
          categories={[]}
        />,
        {context: routerContext}
      );
      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.getByText('3 Configurations')).toBeInTheDocument();
      expect(screen.getByText('Twilio (SMS)')).toHaveAttribute(
        'href',
        `/settings/${org.slug}/plugins/twilio/`
      );
    });

    it('has not been installed', function () {
      render(
        <IntegrationRow
          organization={org}
          type="plugin"
          slug="amazon-sqs"
          displayName="Amazon SQS"
          status="Not Installed"
          publishStatus="published"
          configurations={0}
          categories={[]}
        />
      );
      expect(screen.getByText('Not Installed')).toBeInTheDocument();
      expect(screen.getByText('Amazon SQS')).toBeInTheDocument();
    });
  });
});
