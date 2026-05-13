import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SnapshotPrCommentsToggle} from 'sentry/views/settings/project/preprod/snapshotPrCommentsToggle';

describe('SnapshotPrCommentsToggle', () => {
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
    const project = DetailedProjectFixture({options: {}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Enable Snapshot PR Comments'})
    ).not.toBeChecked();
    expect(
      screen.getByText('Enable PR comments to configure post conditions')
    ).toBeInTheDocument();
  });

  it('shows per-category toggles when enabled with correct defaults', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Enable Snapshot PR Comments'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Changed Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Removed Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Added Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Renamed Snapshots'})
    ).not.toBeChecked();
  });

  it('reflects project values from explicit fields', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: true,
      preprodSnapshotPrCommentsPostOnAdded: true,
      preprodSnapshotPrCommentsPostOnRemoved: false,
      preprodSnapshotPrCommentsPostOnChanged: false,
      preprodSnapshotPrCommentsPostOnRenamed: true,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Post on Added Snapshots'})
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Removed Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Changed Snapshots'})
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Post on Renamed Snapshots'})
    ).toBeChecked();
  });

  it('saves post_on_changed when toggled off', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: true,
    });
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

    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Post on Changed Snapshots'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotPrCommentsPostOnChanged: false},
        })
      )
    );
  });

  it('saves post_on_renamed when toggled on', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: true,
    });
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

    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Post on Renamed Snapshots'})
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotPrCommentsPostOnRenamed: true},
        })
      )
    );
  });

  it('immediately hides post condition toggles when PR comments are disabled', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: true,
    });
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

    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    // Setup mock for after the toggle is switched off
    MockApiClient.addMockResponse({
      url: projectEndpoint,
      body: {...project, preprodSnapshotPrCommentsEnabled: false},
    });

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Enable Snapshot PR Comments'})
    );

    expect(
      await screen.findByText('Enable PR comments to configure post conditions')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Post on Changed Snapshots'})
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {preprodSnapshotPrCommentsEnabled: false},
        })
      )
    );
  });

  it('hides per-category toggles and shows a hint when PR comments are disabled', async () => {
    const project = DetailedProjectFixture({
      options: {},
      preprodSnapshotPrCommentsEnabled: false,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    render(<SnapshotPrCommentsToggle />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText('Enable PR comments to configure post conditions')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Post on Added Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Post on Removed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Post on Changed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Post on Renamed Snapshots'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Enable Snapshot PR Comments'})
    ).toBeEnabled();
  });
});
