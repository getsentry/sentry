import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

jest.mock('sentry/actionCreators/modal');

describe('AddIntegrationRow', function () {
  let org;
  const project = ProjectFixture();
  const provider = GitHubIntegrationProviderFixture();

  beforeEach(function () {
    org = OrganizationFixture();
    jest.clearAllMocks();
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
      <AddIntegrationRow onClick={jest.fn()} />
    </IntegrationContext.Provider>
  );

  it('renders', async () => {
    render(getComponent(), {organization: org});

    const button = await screen.findByRole('button', {name: /add integration/i});
    expect(button).toBeInTheDocument();
  });

  it('opens the setup dialog on click', async () => {
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus, close: jest.fn()});
    // any is needed here because getSentry has different types for global
    (global as any).open = open;

    render(getComponent(), {organization: org});

    const button = await screen.findByRole('button', {name: /add integration/i});
    await userEvent.click(button);
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });

  it('renders request button when user does not have access', async () => {
    org.access = ['org:read'];

    render(getComponent(), {organization: org});

    await screen.findByRole('button', {name: /request installation/i});
  });
});
