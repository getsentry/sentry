import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {IntegrationProvider} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';

describe('AddIntegrationButton', function () {
  let org: Organization, provider: IntegrationProvider;
  const project = ProjectFixture();

  beforeEach(function () {
    provider = GitHubIntegrationProviderFixture();
    org = OrganizationFixture();
  });

  it('Opens the setup dialog on click', async function () {
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus, close: jest.fn()});
    // any is needed here because getSentry has different types for global
    (global as any).open = open;

    render(
      <IntegrationButton
        onAddIntegration={jest.fn()}
        onExternalClick={jest.fn()}
        organization={org}
        project={project}
        provider={provider}
      />
    );

    await userEvent.click(screen.getByLabelText('Add Installation'));
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });

  it.only('Renders request button when user does not have access', async function () {
    org.access = ['org:read'];
    const newOrg = OrganizationFixture({access: ['org:read']});

    render(
      <IntegrationButton
        onAddIntegration={jest.fn()}
        onExternalClick={jest.fn()}
        organization={newOrg}
        project={project}
        provider={provider}
      />
    );

    await userEvent.click(screen.getByLabelText('Request Installation'));
  });

  it('Handles external installations', async function () {
    provider.metadata.aspects = {
      externalInstall: {
        url: 'https://teams.microsoft.com/l/app/',
        buttonText: 'Teams Marketplace',
        noticeText:
          'Visit the Teams Marketplace to install this integration. After adding the integration to your team, you will get a welcome message in the General channel to complete installation.',
      },
    };

    render(
      <IntegrationButton
        onAddIntegration={jest.fn()}
        onExternalClick={jest.fn()}
        organization={org}
        project={project}
        provider={provider}
      />
    );

    console.log(org.access);
    await userEvent.click(screen.getByLabelText('Add Installation'));
  });
});
