import type {Location} from 'history';
import {HealthFixture} from 'sentry-fixture/health';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {ReleaseProject} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import ReleaseActions from 'sentry/views/releases/detail/header/releaseActions';

describe('ReleaseActions', function () {
  const router = RouterFixture();
  const organization = OrganizationFixture();

  const project1 = ReleaseProjectFixture({
    slug: 'project1',
    hasHealthData: true,
    healthData: HealthFixture(),
  }) as Required<ReleaseProject>;

  const project2 = ReleaseProjectFixture({
    slug: 'project2',
    hasHealthData: true,
    healthData: HealthFixture(),
  }) as Required<ReleaseProject>;

  const release = ReleaseFixture({
    projects: [project1, project2],
  });

  const location: Location = {
    ...LocationFixture(),
    pathname: `/organizations/${organization.slug}/releases/${release.version}/`,
    query: {
      project: '1',
      statsPeriod: '24h',
      yAxis: 'events',
    },
  };
  let mockUpdate: ReturnType<typeof MockApiClient.addMockResponse>;

  beforeEach(function () {
    mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      method: 'POST',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('archives a release', async function () {
    render(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0]!.slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...ReleaseMetaFixture(), projects: release.projects}}
        location={location}
      />,
      {router}
    );
    renderGlobalModal({router});

    await userEvent.click(screen.getByLabelText('Actions'));

    const archiveAction = screen.getByTestId('archive');

    expect(archiveAction).toBeInTheDocument();
    expect(archiveAction).toHaveTextContent('Archive');

    await userEvent.click(archiveAction);

    expect(await screen.findByText('Archive Release 1.2.0')).toBeInTheDocument();
    const affectedProjects = screen.getAllByTestId('badge-display-name');
    expect(affectedProjects.length).toBe(2);

    // confirm modal
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          projects: [],
          status: 'archived',
          version: release.version,
        },
      })
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/releases/`
      )
    );
  });

  it('restores a release', async function () {
    const refetchDataMock = jest.fn();

    render(
      <ReleaseActions
        {...RouteComponentPropsFixture()}
        organization={organization}
        projectSlug={release.projects[0]!.slug}
        release={{...release, status: ReleaseStatus.ARCHIVED}}
        refetchData={refetchDataMock}
        releaseMeta={{...ReleaseMetaFixture(), projects: release.projects}}
        location={location}
      />,
      {router}
    );
    renderGlobalModal({router});

    await userEvent.click(screen.getByLabelText('Actions'));

    const restoreAction = screen.getByTestId('restore');

    expect(restoreAction).toBeInTheDocument();
    expect(restoreAction).toHaveTextContent('Restore');

    await userEvent.click(restoreAction);

    expect(await screen.findByText('Restore Release 1.2.0')).toBeInTheDocument();
    const affectedProjects = screen.getAllByTestId('badge-display-name');
    expect(affectedProjects.length).toBe(2);

    // confirm modal
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          projects: [],
          status: 'open',
          version: release.version,
        },
      })
    );

    await waitFor(() => expect(refetchDataMock).toHaveBeenCalledTimes(1));
  });

  it('navigates to a next/prev release', function () {
    const {rerender} = render(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0]!.slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...ReleaseMetaFixture(), projects: release.projects}}
        location={location}
      />,
      {router}
    );

    expect(screen.getByLabelText('Oldest')).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/0/?project=1&statsPeriod=24h&yAxis=events`
    );
    expect(screen.getByLabelText('Older')).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/123/?project=1&statsPeriod=24h&yAxis=events`
    );
    expect(screen.getByLabelText('Newer')).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/456/?project=1&statsPeriod=24h&yAxis=events`
    );
    expect(screen.getByLabelText('Newest')).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/999/?project=1&statsPeriod=24h&yAxis=events`
    );

    rerender(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0]!.slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...ReleaseMetaFixture(), projects: release.projects}}
        location={{
          ...location,
          pathname: `/organizations/${organization.slug}/releases/${release.version}/files-changed/`,
        }}
      />
    );

    expect(screen.getByLabelText('Newer')).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/456/files-changed/?project=1&statsPeriod=24h&yAxis=events`
    );
  });
});
