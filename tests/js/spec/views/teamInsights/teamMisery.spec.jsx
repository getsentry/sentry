import {
  fireEvent,
  mountWithTheme,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import TeamMisery from 'app/views/teamInsights/teamMisery';

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
    const noChange = [
      {
        transaction: '/apple/1',
        user_misery: 0.1,
        ...extraData,
      },
      {
        transaction: '/apple/2',
        user_misery: 0.1,
        ...extraData,
      },
      {
        transaction: '/apple/3',
        user_misery: 0.1,
        ...extraData,
      },
      {
        transaction: '/apple/4',
        user_misery: 0.1,
        ...extraData,
      },
      {
        transaction: '/apple/5',
        user_misery: 0.1,
        ...extraData,
      },
    ];

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
    expect(screen.getAllByText(project.slug)).toHaveLength(2);
    expect(screen.getByText('10% better')).toBeInTheDocument();
    expect(screen.getByText('25% worse')).toBeInTheDocument();
    expect(screen.queryByText('0% change')).not.toBeInTheDocument();

    expect(screen.getByText('More')).toBeInTheDocument();
    fireEvent.click(screen.getByText('More'));
    expect(screen.getAllByText('0% change')).toHaveLength(5);
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

    expect(screen.getByText('There are no items to display')).toBeTruthy();
  });
});
