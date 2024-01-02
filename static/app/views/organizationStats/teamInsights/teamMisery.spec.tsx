import range from 'lodash/range';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import TeamMisery from 'sentry/views/organizationStats/teamInsights/teamMisery';

describe('TeamMisery', () => {
  const {routerProps} = initializeOrg();

  it('should render misery from projects and expand hidden items', async () => {
    const project = ProjectFixture();
    const meta = {
      fields: {
        transaction: 'string',
        project: 'string',
        tpm: 'number',
        'count_unique(user)': 'number',
        'count_miserable(user)': 'number',
        'user_misery()': 'number',
      },
    };
    const extraData = {
      project: project.slug,
      tpm: 30,
      count_unique_user: 1000,
      count_miserable_user: 122,
      project_threshold_config: ['duration', 300],
    };
    const noChangeItems = 10;
    const noChange = range(0, noChangeItems).map(x => ({
      transaction: `/apple/${x}`,
      'user_misery()': 0.1,
      ...extraData,
    }));

    const weekMisery = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      body: {
        meta,
        data: [
          {
            transaction: '/apple/cart',
            'user_misery()': 0.5,
            ...extraData,
          },
          {
            transaction: '/apple/checkout',
            'user_misery()': 0.1,
            ...extraData,
          },
          ...noChange,
        ],
      },
      match: [MockApiClient.matchQuery({statsPeriod: '7d'})],
    });
    const periodMisery = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      body: {
        meta,
        data: [
          {
            transaction: '/apple/cart',
            'user_misery()': 0.25,
            ...extraData,
          },
          {
            transaction: '/apple/checkout',
            'user_misery()': 0.2,
            ...extraData,
          },
          ...noChange,
        ],
      },
      match: [MockApiClient.matchQuery({statsPeriod: '8w'})],
    });

    render(
      <TeamMisery
        organization={Organization()}
        projects={[project]}
        period="8w"
        teamId="0"
        {...routerProps}
      />
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(weekMisery).toHaveBeenCalledTimes(1);
    expect(periodMisery).toHaveBeenCalledTimes(1);

    // Should have 8 items, the rest are collapsed.
    expect(screen.getAllByText(project.slug)).toHaveLength(5);

    expect(screen.getByText('10% better')).toBeInTheDocument();
    expect(screen.getByText('25% worse')).toBeInTheDocument();
    expect(screen.getAllByText('0% change')).toHaveLength(3);

    expect(screen.getByText('Show 7 More')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Show 7 More'));
    expect(screen.getAllByText('0% change')).toHaveLength(noChangeItems);
  });

  it('should render empty state', () => {
    render(
      <TeamMisery
        organization={Organization()}
        projects={[]}
        period="8w"
        teamId="0"
        {...routerProps}
      />
    );

    expect(
      screen.getByText('No key transactions starred by this team')
    ).toBeInTheDocument();
  });

  it('should render empty state on error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      statusCode: 500,
      body: {},
    });

    render(
      <TeamMisery
        organization={Organization()}
        projects={[ProjectFixture()]}
        period="8w"
        teamId="0"
        {...routerProps}
      />
    );

    await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('There was an error loading data.')).toBeInTheDocument();
  });
});
