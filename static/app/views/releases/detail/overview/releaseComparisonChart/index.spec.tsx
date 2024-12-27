import {ReleaseFixture} from 'sentry-fixture/release';
import {
  SessionUserCountByStatus2Fixture,
  SessionUserCountByStatusFixture,
} from 'sentry-fixture/sessions';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ReleaseProject} from 'sentry/types/release';
import ReleaseComparisonChart from 'sentry/views/releases/detail/overview/releaseComparisonChart';

describe('Releases > Detail > Overview > ReleaseComparison', () => {
  const {router, organization, project: rawProject} = initializeOrg();
  const api = new MockApiClient();
  const release = ReleaseFixture();
  const releaseSessions = SessionUserCountByStatusFixture();
  const allSessions = SessionUserCountByStatus2Fixture();

  const project: ReleaseProject = {
    ...rawProject,
    id: parseInt(rawProject.id, 10),
    newGroups: 0,
    platform: 'java',
    platforms: ['java'],
  };

  it('displays correct all/release/change data', () => {
    render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...router.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {router}
    );

    expect(screen.getByLabelText('Chart Title')).toHaveTextContent(
      'Crash Free Session Rate'
    );
    expect(screen.getByLabelText('Chart Value')).toHaveTextContent(/95\.006% 4\.51%/);

    expect(screen.getAllByRole('radio').length).toBe(2);

    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate 99.516%95.006%4.51% Crash Free User Rate 99.908%75%24.908% Show 2 Others"` // eslint-disable-line no-irregular-whitespace
    );
  });

  it('can change chart by clicking on a row', async () => {
    const {rerender} = render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...router.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {router}
    );

    await userEvent.click(screen.getByLabelText(/crash free user rate/i));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {chart: 'crashFreeUsers'}})
    );

    rerender(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...router.location, query: {chart: 'crashFreeUsers'}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />
    );

    expect(screen.getByLabelText('Chart Title')).toHaveTextContent(
      'Crash Free User Rate'
    );
    expect(screen.getByLabelText('Chart Value')).toHaveTextContent(/75% 24\.908%/);
  });

  it('can expand row to show more charts', async () => {
    render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...router.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {router}
    );

    for (const toggle of screen.getAllByLabelText(/toggle chart/i)) {
      await userEvent.click(toggle);
    }

    await userEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio').length).toBe(12);
    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate 99.516%95.006%4.51% Healthy 98.564%94.001%4.563% Abnormal 0%0%0% Errored 0.953%1.005%0.052% Crashed Session Rate 0.484%4.994%4.511% Crash Free User Rate 99.908%75%24.908% Healthy 98.994%72.022%26.972% Abnormal 0%0%0% Errored 0.914%2.493%1.579% Crashed User Rate 0.092%25.485%25.393% Session Count 205k9.8k—User Count 100k361—Hide 2 Others"` // eslint-disable-line no-irregular-whitespace
    );

    // toggle back
    for (const toggle of screen.getAllByLabelText(/toggle chart/i)) {
      await userEvent.click(toggle);
    }
    await userEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio').length).toBe(2);
  });

  it('does not show expanders if there is no health data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      body: 0,
    });

    render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={null}
        allSessions={null}
        platform="javascript"
        location={{...router.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={{
          ...organization,
          features: [...organization.features, 'discover-basic'],
        }}
        api={api}
        hasHealthData={false}
      />,
      {router}
    );

    expect(screen.getAllByRole('radio').length).toBe(1);
    expect(screen.queryByLabelText(/toggle chart/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/toggle additional/i)).not.toBeInTheDocument();

    // Wait for api requests to propegate
    await act(tick);
  });
});
