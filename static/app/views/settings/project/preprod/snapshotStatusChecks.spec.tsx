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

  it('disables and visually clears per-category toggles when status checks are disabled', async () => {
    const project = ProjectFixture({
      options: {},
      preprodSnapshotStatusChecksEnabled: false,
      preprodSnapshotStatusChecksFailOnChanged: true,
      preprodSnapshotStatusChecksFailOnRemoved: true,
    });
    render(<SnapshotStatusChecks />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    const failOnAdded = await screen.findByRole('checkbox', {
      name: 'Fail on Added Snapshots',
    });
    const failOnRemoved = screen.getByRole('checkbox', {
      name: 'Fail on Removed Snapshots',
    });
    const failOnChanged = screen.getByRole('checkbox', {
      name: 'Fail on Changed Snapshots',
    });
    const failOnRenamed = screen.getByRole('checkbox', {
      name: 'Fail on Renamed Snapshots',
    });

    expect(failOnAdded).toBeDisabled();
    expect(failOnRemoved).toBeDisabled();
    expect(failOnChanged).toBeDisabled();
    expect(failOnRenamed).toBeDisabled();

    // Stored values may be on, but the disabled state should read as off so
    // users don't see a confusing mix of "off but on" toggles.
    expect(failOnAdded).not.toBeChecked();
    expect(failOnRemoved).not.toBeChecked();
    expect(failOnChanged).not.toBeChecked();
    expect(failOnRenamed).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Enable Snapshot Status Checks'})
    ).toBeEnabled();
  });
});
