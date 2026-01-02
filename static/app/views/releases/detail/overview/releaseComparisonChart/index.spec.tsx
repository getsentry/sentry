import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {
  SessionUserCountByStatus2Fixture,
  SessionUserCountByStatusFixture,
} from 'sentry-fixture/sessions';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';

import type {ReleaseProject} from 'sentry/types/release';
import ReleaseComparisonChart from 'sentry/views/releases/detail/overview/releaseComparisonChart';

describe('Releases > Detail > Overview > ReleaseComparison', () => {
  const organization = OrganizationFixture();
  const rawProject = ProjectFixture();
  const release = ReleaseFixture();
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/releases/${release.version}/`,
      query: {},
    },
    routes: ['/organizations/:orgId/releases/:release/'],
  };
  const api = new MockApiClient();
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
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        api={api}
        hasHealthData
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(screen.getByLabelText('Chart Title')).toHaveTextContent(
      'Crash Free Session Rate'
    );
    expect(screen.getByLabelText('Chart Value')).toHaveTextContent(/95\.006% 4\.51%/);

    expect(screen.getAllByRole('radio')).toHaveLength(2);

    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate99.516%95.006%4.51% Crash Free User Rate99.908%75%24.908% Show 2 Others"`
    );
  });

  it('can change chart by clicking on a row', async () => {
    const {router} = render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={releaseSessions}
        allSessions={allSessions}
        platform="javascript"
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        api={api}
        hasHealthData
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    await userEvent.click(screen.getByLabelText(/crash free user rate/i));

    expect(router.location.query).toEqual(
      expect.objectContaining({chart: 'crashFreeUsers'})
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
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        api={api}
        hasHealthData
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    for (const toggle of screen.getAllByLabelText(/toggle chart/i)) {
      await userEvent.click(toggle);
    }

    await userEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio')).toHaveLength(14);
    // lazy way to make sure that all percentages are calculated correctly
    expect(
      screen.getByTestId('release-comparison-table').textContent
    ).toMatchInlineSnapshot(
      `"DescriptionAll ReleasesThis ReleaseChangeCrash Free Session Rate99.516%95.006%4.51% Healthy98.564%94.001%4.563% Abnormal0%0%0% Errored0.953%1.005%0.052% Unhandled0%0%0% Crashed Session Rate0.484%4.994%4.511% Crash Free User Rate99.908%75%24.908% Healthy98.994%72.022%26.972% Abnormal0%0%0% Errored0.914%2.493%1.579% Unhandled0%0%0% Crashed User Rate0.092%25.485%25.393% Session Count205k9.8k—User Count100k361—Hide 2 Others"`
    );

    // toggle back
    for (const toggle of screen.getAllByLabelText(/toggle chart/i)) {
      await userEvent.click(toggle);
    }
    await userEvent.click(screen.getByLabelText(/toggle additional/i));

    expect(screen.getAllByRole('radio')).toHaveLength(2);
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
    const noHealthDataOrganization = OrganizationFixture({
      features: [...organization.features, 'discover-basic'],
    });

    render(
      <ReleaseComparisonChart
        release={release}
        releaseSessions={null}
        allSessions={null}
        platform="javascript"
        loading={false}
        reloading={false}
        errored={false}
        project={project}
        api={api}
        hasHealthData={false}
      />,
      {
        organization: noHealthDataOrganization,
        initialRouterConfig,
      }
    );

    expect(await screen.findAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByLabelText(/toggle chart/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/toggle additional/i)).not.toBeInTheDocument();
  });
});
