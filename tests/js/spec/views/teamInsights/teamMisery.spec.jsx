import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamMisery from 'app/views/teamInsights/teamMisery';

describe('TeamMisery', () => {
  it('should render misery from projects', async () => {
    const project = TestStubs.Project();
    const sessionsApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/eventsv2/`,
      body: {
        meta: {
          transaction: 'string',
          project: 'string',
          tpm: 'number',
          count_unique_user: 'number',
          count_miserable_user: 'number',
          user_misery: 'number',
        },
        data: [
          {
            transaction: '/apple/cart',
            project: project.slug,
            tpm: 30,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
          {
            transaction: '/apple/checkout',
            project: project.slug,
            tpm: 30,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
    });
    const routerContext = TestStubs.routerContext();
    const wrapper = mountWithTheme(
      <TeamMisery
        organization={TestStubs.Organization()}
        projects={[project]}
        period="14d"
        location={routerContext.context}
      />,
      {context: routerContext}
    );

    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(sessionsApi).toHaveBeenCalledTimes(2);
    expect(wrapper.getAllByText(project.slug)).toHaveLength(2);
    expect(wrapper.getAllByText('0% change')).toHaveLength(2);
  });
});
