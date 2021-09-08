import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ReleaseComparisonChart from 'app/views/releases/detail/overview/releaseComparisonChart';

describe('Releases > Detail > Overview > ReleaseComparison', () => {
  const {routerContext, organization, project} = initializeOrg();
  // @ts-expect-error
  const api = new MockApiClient();
  // @ts-expect-error
  const release = TestStubs.Release();
  // @ts-expect-error
  const releaseSessions = TestStubs.SessionUserCountByStatus();
  // @ts-expect-error
  const allSessions = TestStubs.SessionUserCountByStatus2();

  it('displays correct all/release/change data', () => {
    mountWithTheme(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...routerContext.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {context: routerContext}
    );

    expect(screen.getByLabelText('Chart Title').textContent).toBe(
      'Crash Free Session Rate'
    );
    expect(screen.getByLabelText('Chart Value').textContent).toContain('95.006% 4.51%');

    expect(screen.getAllByRole('radio').length).toBe(3);

    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      // eslint-disable-next-line no-irregular-whitespace
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate 99.516%95.006%4.51% Crash Free User Rate 99.908%75%24.908% Session Duration p50 37s195ms—Show 2 Others"`
    );
  });

  it('can change chart by clicking on a row', () => {
    const {rerender} = mountWithTheme(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...routerContext.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {context: routerContext}
    );

    fireEvent.click(screen.getByLabelText(/crash free user rate/i));

    expect(browserHistory.push).toHaveBeenCalledWith({query: {chart: 'crashFreeUsers'}});

    rerender(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...routerContext.location, query: {chart: 'crashFreeUsers'}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />
    );

    expect(screen.getByLabelText('Chart Title').textContent).toBe('Crash Free User Rate');
    expect(screen.getByLabelText('Chart Value').textContent).toContain('75% 24.908%');
  });

  it('can expand row to show more charts', () => {
    mountWithTheme(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        location={{...routerContext.location, query: {}}}
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        organization={organization}
        api={api}
        hasHealthData
      />,
      {context: routerContext}
    );

    screen.getAllByLabelText(/toggle chart/i).forEach(toggle => {
      fireEvent.click(toggle);
    });
    fireEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio').length).toBe(13);
    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      // eslint-disable-next-line no-irregular-whitespace
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate 99.516%95.006%4.51% Healthy 98.564%94.001%4.563% Abnormal 0%0%0% —Errored 0.953%1.005%0.052% Crashed Session Rate 0.484%4.994%4.511% Crash Free User Rate 99.908%75%24.908% Healthy 98.994%72.022%26.972% Abnormal 0%0%0% —Errored 0.914%2.493%1.579% Crashed User Rate 0.092%25.485%25.393% Session Duration p50 37s195ms—Hide 2 OthersSession Count 205k9.8k—User Count 100k361—"`
    );

    // toggle back
    screen.getAllByLabelText(/toggle chart/i).forEach(toggle => {
      fireEvent.click(toggle);
    });
    fireEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio').length).toBe(3);
  });

  it('does not show expanders if there is no health data', () => {
    mountWithTheme(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={null}
        allSessions={null}
        platform="javascript"
        location={{...routerContext.location, query: {}}}
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
      {context: routerContext}
    );

    expect(screen.getAllByRole('radio').length).toBe(1);
    expect(screen.queryByLabelText(/toggle chart/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/toggle additional/i)).not.toBeInTheDocument();
  });
});
