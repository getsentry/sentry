import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SnapshotStatusChecks} from 'sentry/views/settings/project/preprod/snapshotStatusChecks';

describe('SnapshotStatusChecks', () => {
  const {organization} = initializeOrg();
  const initialRouterConfig = {
    location: {
      pathname: `/settings/projects/test-project/snapshots/`,
    },
    route: '/settings/projects/:projectId/snapshots/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders default values when the project has no preprod options', async () => {
    const project = ProjectFixture({options: {}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Enable Snapshot Status Checks'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Added Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Removed Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Changed Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Renamed Snapshots'})
    ).not.toBeChecked();
  });

  it('reflects project values from explicit fields', async () => {
    const project = ProjectFixture({
      options: {},
      preprodSnapshotStatusChecksEnabled: true,
      preprodSnapshotStatusChecksFailOnAdded: true,
      preprodSnapshotStatusChecksFailOnRemoved: false,
      preprodSnapshotStatusChecksFailOnChanged: false,
      preprodSnapshotStatusChecksFailOnRenamed: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Fail on Added Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Removed Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Changed Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Fail on Renamed Snapshots'})
    ).toBeChecked();
  });

  it('saves fail_on_changed when toggled off', async () => {
    const project = ProjectFixture({options: {}});
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: project,
    });
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {},
    });

    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Fail on Changed Snapshots'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotStatusChecksFailOnChanged: false},
        })
      )
    );
  });

  it('saves fail_on_renamed when toggled on', async () => {
    const project = ProjectFixture({options: {}});
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: project,
    });
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {},
    });

    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Fail on Renamed Snapshots'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotStatusChecksFailOnRenamed: true},
        })
      )
    );
  });

  it('immediately hides failure condition toggles when status checks are disabled', async () => {
    const project = ProjectFixture({options: {}});
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: project,
    });
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {},
    });

    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    // Setup mock for after the toggle is switched off
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: {...project, preprodSnapshotStatusChecksEnabled: false},
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Enable Snapshot Status Checks',
      })
    );

    expect(
      await screen.findByText('Enable status checks to configure failure conditions')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Fail on Changed Snapshots'})
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotStatusChecksEnabled: false},
        })
      )
    );
  });

  it('hides per-category toggles and shows a hint when status checks are disabled', async () => {
    const project = ProjectFixture({
      options: {},
      preprodSnapshotStatusChecksEnabled: false,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText('Enable status checks to configure failure conditions')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Fail on Added Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Fail on Removed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Fail on Changed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Fail on Renamed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Enable Snapshot Status Checks'})
    ).toBeEnabled();
  });
});
