import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

describe('AddIntegrationButton', function () {
  let org: Organization,
    provider: IntegrationProvider,
    hasAccess: boolean,
    externalInstallText: string | undefined;
  const project = ProjectFixture();

  beforeEach(function () {
    provider = GitHubIntegrationProviderFixture();
    org = OrganizationFixture();
    hasAccess = true;
    externalInstallText = undefined;
  });

  const getComponent = () => (
    <IntegrationContext.Provider
      value={{
        provider,
        type: 'first_party',
        installStatus: 'Not Installed',
        analyticsParams: {
          view: 'onboarding',
          already_installed: false,
        },
        modalParams: {project: project.id},
      }}
    >
      <IntegrationButton
        userHasAccess={hasAccess}
        onAddIntegration={jest.fn()}
        onExternalClick={jest.fn()}
        externalInstallText={externalInstallText}
        buttonProps={null}
      />
    </IntegrationContext.Provider>
  );

  it('Opens the setup dialog on click', async function () {
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus, close: jest.fn()});
    // any is needed here because getSentry has different types for global
    (global as any).open = open;

    render(getComponent());

    await userEvent.click(screen.getByText(/add installation/i));
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });

  it('Renders request button when user does not have access', async function () {
    hasAccess = false;

    render(getComponent(), {organization: org});

    await userEvent.click(screen.getByText('Request Installation'));
  });

  it('Handles external installations with default button text', async function () {
    provider.canAdd = false;
    provider.metadata.aspects = {
      externalInstall: {
        url: 'https://teams.microsoft.com/l/app/',
        buttonText: 'Teams Marketplace',
        noticeText:
          'Visit the Teams Marketplace to install this integration. After adding the integration to your team, you will get a welcome message in the General channel to complete installation.',
      },
    };

    render(getComponent(), {organization: org});

    await userEvent.click(screen.getByText('Teams Marketplace'));
  });

  it('Handles external installations with custom button text', async function () {
    provider.canAdd = false;
    provider.metadata.aspects = {
      externalInstall: {
        url: 'https://teams.microsoft.com/l/app/',
        buttonText: 'Teams Marketplace',
        noticeText:
          'Visit the Teams Marketplace to install this integration. After adding the integration to your team, you will get a welcome message in the General channel to complete installation.',
      },
    };
    externalInstallText = 'Add Installation';

    render(getComponent(), {organization: org});

    await userEvent.click(screen.getByText('Add Installation'));
  });
});
