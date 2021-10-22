import range from 'lodash/range';

import {
  fireEvent,
  mountWithTheme,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import TeamMisery from 'app/views/organizationStats/teamInsights/teamMisery';

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

    const weekMisery = MockApiClient.addMockResponse(
      {
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
      },
      {
        predicate: (url, options) => {
          return url.includes('eventsv2') && options.query?.statsPeriod === '7d';
        },
      }
    );
    const periodMisery = MockApiClient.addMockResponse(
      {
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
      },
      {
        predicate: (url, options) => {
          return url.includes('eventsv2') && options.query?.statsPeriod === '8w';
        },
      }
    );
    const routerContext = TestStubs.routerContext();
    mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[project]}
        period="8w"
        location={routerContext.context}
      />,
      {context: routerContext}
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(weekMisery).toHaveBeenCalledTimes(1);
    expect(periodMisery).toHaveBeenCalledTimes(1);

    // Should have 8 items, the rest are collapsed.
    expect(screen.getAllByText(project.slug)).toHaveLength(5);

    expect(screen.getByText('10% better')).toBeInTheDocument();
    expect(screen.getByText('25% worse')).toBeInTheDocument();
    expect(screen.getAllByText('0% change')).toHaveLength(3);

    expect(screen.getByText('More')).toBeInTheDocument();
    fireEvent.click(screen.getByText('More'));
    expect(screen.getAllByText('0% change')).toHaveLength(noChangeItems);
  });

  it('should render empty state', async () => {
    const routerContext = TestStubs.routerContext();
    mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[]}
        period="8w"
        location={routerContext.context}
      />,
      {context: routerContext}
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(screen.getByText('There are no items to display')).toBeInTheDocument();
  });
});
