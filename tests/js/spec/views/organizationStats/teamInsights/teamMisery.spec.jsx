import range from 'lodash/range';

import {
  mountWithTheme,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import TeamMisery from 'sentry/views/organizationStats/teamInsights/teamMisery';

describe('TeamMisery', () => {
  it('should render misery from projects and expand hidden items', async () => {
    const project = TestStubs.Project();
    const meta = {
      transaction: 'string',
      project: 'string',
      tpm: 'number',
      count_unique_user: 'number',
      count_miserable_user: 'number',
      user_misery: 'number',
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
      user_misery: 0.1,
      ...extraData,
    }));

    const weekMisery = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/eventsv2/`,
      body: {
        meta,
        data: [
          {
            transaction: '/apple/cart',
            user_misery: 0.5,
            ...extraData,
          },
          {
            transaction: '/apple/checkout',
            user_misery: 0.1,
            ...extraData,
          },
          ...noChange,
        ],
      },
      match: [MockApiClient.matchQuery({statsPeriod: '7d'})],
    });
    const periodMisery = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/eventsv2/`,
      body: {
        meta,
        data: [
          {
            transaction: '/apple/cart',
            user_misery: 0.25,
            ...extraData,
          },
          {
            transaction: '/apple/checkout',
            user_misery: 0.2,
            ...extraData,
          },
          ...noChange,
        ],
      },
      match: [MockApiClient.matchQuery({statsPeriod: '8w'})],
    });

    mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[project]}
        period="8w"
        location={location}
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

    expect(screen.getByText('More')).toBeInTheDocument();
    userEvent.click(screen.getByText('More'));
    expect(screen.getAllByText('0% change')).toHaveLength(noChangeItems);
  });

  it('should render empty state', async () => {
    mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[]}
        period="8w"
        location={location}
      />
    );

    expect(
      screen.getByText('No key transactions starred by this team')
    ).toBeInTheDocument();
  });

  it('should render empty state on error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/eventsv2/`,
      statusCode: 500,
      body: {},
    });

    mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[TestStubs.Project()]}
        period="8w"
        location={location}
      />
    );

    await waitForElementToBeRemoved(screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('There was an error loading data.')).toBeInTheDocument();
  });
});
