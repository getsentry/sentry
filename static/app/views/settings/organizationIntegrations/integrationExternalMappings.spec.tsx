import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import IntegrationExternalMappings from './integrationExternalMappings';

describe('IntegrationExternalMappings', function () {
  const {organization, router} = initializeOrg();

  const onCreateMock = jest.fn();
  const onDeleteMock = jest.fn();

  const MOCK_USER_SUGGESTIONS = ['@peter', '@ned', '@mj'];
  const MOCK_TEAM_SUGGESTIONS = [
    '@getsentry/snacks',
    '@getsentry/sports',
    '@getsentry/hype',
  ];
  const MOCK_USER_MAPPINGS = [
    {
      id: '1',
      userId: '1',
      externalName: '@gwen',
      sentryName: 'gwen@mcu.org',
    },
    {
      id: '2',
      userId: '2',
      externalName: '@eddie',
      sentryName: 'eddie@mcu.org',
    },
  ];
  const MOCK_TEAM_MAPPINGS = [
    {
      id: '1',
      teamId: '1',
      externalName: '@getsentry/animals',
      sentryName: '#zoo',
    },
    {
      id: '2',
      teamId: '2',
      externalName: '@getsentry/ghosts',
      sentryName: '#boo',
    },
  ];

  const createMockSuggestions = () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      method: 'GET',
      body: {
        'project-1': {
          errors: {
            missing_external_users: MOCK_USER_SUGGESTIONS,
            missing_external_teams: MOCK_TEAM_SUGGESTIONS,
          },
        },
      },
    });
  };

  it('renders empty if not mappings are provided or found', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      method: 'GET',
      body: {},
    });
    const {container} = render(
      <IntegrationExternalMappings
        organization={organization}
        integration={GitHubIntegrationFixture()}
        mappings={[]}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
        dataEndpoint="/organizations/org-slug/codeowners-associations/"
        getBaseFormEndpoint={() => '/organizations/org-slug/codeowners-associations/'}
        sentryNamesMapper={data => data}
      />,
      {
        router,
      }
    );
    expect(container).toHaveTextContent('Set up External User Mappings.');
  });

  it('still renders suggestions if no mappings are provided', async function () {
    createMockSuggestions();
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={GitHubIntegrationFixture()}
        mappings={[]}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
        dataEndpoint="/organizations/org-slug/codeowners-associations/"
        getBaseFormEndpoint={() => '/organizations/org-slug/codeowners-associations/'}
        sentryNamesMapper={data => data}
      />,
      {
        router,
      }
    );

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    for (const user of MOCK_USER_SUGGESTIONS) {
      expect(screen.getByText(user)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId('more-information')).toHaveLength(3);
  });

  it('renders suggestions along with the provided mappings', async function () {
    createMockSuggestions();
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={GitHubIntegrationFixture()}
        mappings={MOCK_TEAM_MAPPINGS}
        type="team"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
        dataEndpoint="/organizations/org-slug/codeowners-associations/"
        getBaseFormEndpoint={() => '/organizations/org-slug/codeowners-associations/'}
        sentryNamesMapper={data => data}
      />,
      {
        router,
      }
    );

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    for (const team of MOCK_TEAM_SUGGESTIONS) {
      expect(screen.getByText(team)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', {name: 'Remove user mapping'})).toHaveLength(2);

    for (const team of MOCK_TEAM_MAPPINGS) {
      expect(screen.getByText(team.externalName)).toBeInTheDocument();
      expect(screen.getByText(team.sentryName)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId('more-information')).toHaveLength(3);
  });

  it('uses the methods passed down from props appropriately', async function () {
    createMockSuggestions();
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={GitHubIntegrationFixture()}
        mappings={MOCK_USER_MAPPINGS}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
        dataEndpoint="/organizations/org-slug/codeowners-associations/"
        getBaseFormEndpoint={() => '/organizations/org-slug/codeowners-associations/'}
        sentryNamesMapper={data => data}
      />,
      {
        router,
      }
    );
    renderGlobalModal();

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('add-mapping-button'));
    expect(onCreateMock).toHaveBeenCalled();

    await userEvent.click(
      screen.getAllByRole('button', {name: 'Remove user mapping'})[0]!
    );
    await userEvent.click(screen.getByTestId('confirm-button'));
    expect(onDeleteMock).toHaveBeenCalled();
  });
});
