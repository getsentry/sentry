import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamStability from 'app/views/teamInsights/teamStability';

describe('TeamStability', () => {
  it('should render project crash rate', async () => {
    const sessionsApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sessions/`,
      body: TestStubs.SessionStatusCountByProjectInPeriod(),
    });
    const project = TestStubs.Project({hasSessions: true});
    const wrapper = mountWithTheme(
      <TeamStability
        projects={[project]}
        organization={TestStubs.Organization()}
        period="24h"
      />
    );

    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-placeholder')).toBeNull();
    });

    expect(wrapper.getByText('project-slug')).toBeInTheDocument();
    expect(wrapper.getByText('90%')).toBeInTheDocument();
    expect(sessionsApi).toHaveBeenCalledTimes(2);
  });

  it('should render no sessions', async () => {
    const noSessionProject = TestStubs.Project({hasSessions: false});
    const wrapper = mountWithTheme(
      <TeamStability
        projects={[noSessionProject]}
        organization={TestStubs.Organization()}
        period="24h"
      />
    );

    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-placeholder')).toBeNull();
    });

    expect(wrapper.getByText('\u2014')).toBeInTheDocument();
  });
});
