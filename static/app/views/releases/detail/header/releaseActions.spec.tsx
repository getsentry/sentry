import {browserHistory} from 'react-router';
import {Location} from 'history';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ReleaseActions from 'sentry/views/releases/detail/header/releaseActions';

describe('ReleaseActions', function () {
  const organization = TestStubs.Organization();
  const release = TestStubs.Release({projects: [{slug: 'project1'}, {slug: 'project2'}]});
  const location: Location = {
    ...TestStubs.location(),
    pathname: `/organizations/sentry/releases/${release.version}/`,
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
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...TestStubs.Release(), projects: release.projects}}
        location={location}
      />
    );
    renderGlobalModal();

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
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/releases/`
      )
    );
  });

  it('restores a release', async function () {
    const refetchDataMock = jest.fn();

    render(
      <ReleaseActions
        {...TestStubs.routeComponentProps()}
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={{...release, status: 'archived'}}
        refetchData={refetchDataMock}
        releaseMeta={{...TestStubs.Release(), projects: release.projects}}
        location={location}
      />
    );
    renderGlobalModal();

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
    const routerContext = TestStubs.routerContext();
    const {rerender} = render(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...TestStubs.Release(), projects: release.projects}}
        location={location}
      />,
      {context: routerContext}
    );

    expect(screen.getByLabelText('Oldest')).toHaveAttribute(
      'href',
      '/organizations/sentry/releases/0/?project=1&statsPeriod=24h&yAxis=events'
    );
    expect(screen.getByLabelText('Older')).toHaveAttribute(
      'href',
      '/organizations/sentry/releases/123/?project=1&statsPeriod=24h&yAxis=events'
    );
    expect(screen.getByLabelText('Newer')).toHaveAttribute(
      'href',
      '/organizations/sentry/releases/456/?project=1&statsPeriod=24h&yAxis=events'
    );
    expect(screen.getByLabelText('Newest')).toHaveAttribute(
      'href',
      '/organizations/sentry/releases/999/?project=1&statsPeriod=24h&yAxis=events'
    );

    rerender(
      <ReleaseActions
        organization={organization}
        projectSlug={release.projects[0].slug}
        release={release}
        refetchData={jest.fn()}
        releaseMeta={{...TestStubs.Release(), projects: release.projects}}
        location={{
          ...location,
          pathname: `/organizations/sentry/releases/${release.version}/files-changed/`,
        }}
      />
    );

    expect(screen.getByLabelText('Newer')).toHaveAttribute(
      'href',
      '/organizations/sentry/releases/456/files-changed/?project=1&statsPeriod=24h&yAxis=events'
    );
  });
});
