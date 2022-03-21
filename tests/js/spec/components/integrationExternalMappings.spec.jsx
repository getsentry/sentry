import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IntegrationExternalMappings from 'sentry/components/integrationExternalMappings';

describe('IntegrationExternalMappings', function () {
  const {organization, routerContext} = initializeOrg();

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

  it('renders empty if not mappings are provided or found', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      method: 'GET',
      body: {},
    });
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={TestStubs.GitHubIntegration()}
        mappings={[]}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
      />,
      {
        context: routerContext,
      }
    );
    await act(tick);
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });

  it('still renders suggestions if no mappings are provided', async function () {
    createMockSuggestions();
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={TestStubs.GitHubIntegration()}
        mappings={[]}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
      />,
      {
        context: routerContext,
      }
    );
    await act(tick);

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    for (const user of MOCK_USER_SUGGESTIONS) {
      expect(await screen.findByText(user)).toBeInTheDocument();
    }
    expect(await screen.findAllByTestId('suggestion-option')).toHaveLength(3);
  });

  it('renders suggestions along with the provided mappings', async function () {
    createMockSuggestions();
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={TestStubs.GitHubIntegration()}
        mappings={MOCK_TEAM_MAPPINGS}
        type="team"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
      />,
      {
        context: routerContext,
      }
    );
    await act(tick);

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    for (const team of MOCK_TEAM_SUGGESTIONS) {
      expect(await screen.findByText(team)).toBeInTheDocument();
    }
    expect(await screen.findAllByTestId('mapping-option')).toHaveLength(2);

    for (const team of MOCK_TEAM_MAPPINGS) {
      expect(await screen.findByText(team.externalName)).toBeInTheDocument();
      expect(await screen.findByText(team.sentryName)).toBeInTheDocument();
    }
    expect(await screen.findAllByTestId('suggestion-option')).toHaveLength(3);
  });

  it('uses the methods passed down from props appropriately', async function () {
    render(
      <IntegrationExternalMappings
        organization={organization}
        integration={TestStubs.GitHubIntegration()}
        mappings={MOCK_USER_MAPPINGS}
        type="user"
        onCreate={onCreateMock}
        onDelete={onDeleteMock}
        defaultOptions={[]}
      />,
      {
        context: routerContext,
      }
    );
    await act(tick);

    expect(await screen.findByTestId('mapping-table')).toBeInTheDocument();
    userEvent.click(screen.getByTestId('add-mapping-button'));
    expect(onCreateMock).toHaveBeenCalled();

    userEvent.click(screen.getAllByTestId('delete-mapping-button')[0]);
    await act(tick);
    mountGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));
    expect(onDeleteMock).toHaveBeenCalled();
  });
});
