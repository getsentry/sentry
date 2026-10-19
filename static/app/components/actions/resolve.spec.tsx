import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ResolveActions} from 'sentry/components/actions/resolve';

describe('ResolveActions', () => {
  const project = ProjectFixture({id: '1', slug: 'proj-1'});
  const releaseProject = ProjectFixture({id: '2', slug: 'project-slug'});
  const spy = jest.fn();
  afterEach(() => {
    spy.mockClear();
    MockApiClient.clearMockResponses();
  });

  describe('disabled', () => {
    it('does not call onUpdate when clicked', async () => {
      render(
        <ResolveActions
          hasSemverReleaseFeature={false}
          onUpdate={spy}
          disabled
          hasRelease={false}
          project={project}
        />
      );
      const button = screen.getByRole('button', {name: 'Resolve'});
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('disableDropdown', () => {
    it('main button calls onUpdate when clicked and dropdown menu disabled', async () => {
      render(
        <ResolveActions
          hasSemverReleaseFeature={false}
          onUpdate={spy}
          disableDropdown
          hasRelease={false}
          project={project}
        />
      );

      const button = screen.getByRole('button', {name: 'Resolve'});
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(spy).toHaveBeenCalled();

      // Dropdown menu is disabled
      expect(screen.getByRole('button', {name: 'More resolve options'})).toBeDisabled();
    });
  });

  describe('without confirmation', () => {
    it('calls spy with resolved status when clicked', async () => {
      render(
        <ResolveActions
          hasSemverReleaseFeature={false}
          onUpdate={spy}
          hasRelease={false}
          project={project}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        status: 'resolved',
        statusDetails: {},
        substatus: null,
      });
    });
  });

  describe('with confirmation step', () => {
    it('displays confirmation modal with message provided', async () => {
      render(
        <ResolveActions
          hasSemverReleaseFeature={false}
          onUpdate={spy}
          hasRelease={false}
          project={project}
          shouldConfirm
          confirmMessage="Are you sure???"
        />
      );
      renderGlobalModal();

      const button = screen.getByRole('button', {name: 'Resolve'});
      await userEvent.click(button);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();

      await userEvent.click(confirmButton);

      expect(spy).toHaveBeenCalled();
    });
  });

  it('can resolve in "another version"', async () => {
    const onUpdate = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture()],
    });
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        hasRelease
        project={releaseProject}
        onUpdate={onUpdate}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByLabelText('More resolve options'));
    await userEvent.click(screen.getByText('Another existing release…'));

    const versionTrigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(versionTrigger);
    const option = await screen.findByRole('option', {name: /1\.2\.0/});
    await userEvent.click(option);

    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', {name: 'Resolve'}));
    expect(onUpdate).toHaveBeenCalledWith({
      status: 'resolved',
      statusDetails: {
        inRelease: 'sentry-android-shop@1.2.0',
      },
      substatus: null,
    });
  });

  it('displays if the current release version uses semver and flag is not enabled', async () => {
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        onUpdate={spy}
        hasRelease
        project={project}
        latestRelease={{version: 'frontend@1.2.3'}}
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(screen.getByText('The current release')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('(semver)')).toBeInTheDocument();
  });

  it('shows resolve in semver release option when the current release version uses semver and flag is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture()],
    });

    render(
      <ResolveActions
        hasSemverReleaseFeature
        onUpdate={spy}
        hasRelease
        project={project}
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(screen.getByText('The current semver release')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('The current release')).not.toBeInTheDocument();
  });

  it('shows resolve in latest release option when the current release version does not use semver and flag is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    render(
      <ResolveActions
        hasSemverReleaseFeature
        onUpdate={spy}
        hasRelease
        project={project}
        latestRelease={{version: 'frontend@abc123def'}}
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(screen.getByText('The current release')).toBeInTheDocument();
    expect(screen.getByText('abc123def')).toBeInTheDocument();
    expect(screen.getByText('(non-semver)')).toBeInTheDocument();
    expect(screen.queryByText('The current semver release')).not.toBeInTheDocument();
  });

  it('displays prompt to setup releases when there are no releases', async () => {
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        onUpdate={spy}
        hasRelease={false}
        project={project}
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(screen.getByText('Resolving is better with Releases')).toBeInTheDocument();
  });

  it('does not prompt to setup releases when multiple projects are selected', async () => {
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        onUpdate={spy}
        hasRelease={false}
        project={project}
        multipleProjectsSelected
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(
      screen.getByRole('menuitemradio', {name: 'The current release'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Resolving is better with Releases')
    ).not.toBeInTheDocument();
  });

  it('does render more resolve options', () => {
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        onUpdate={spy}
        hasRelease={false}
        project={project}
        disableResolveInRelease={false}
      />
    );
    expect(screen.getByLabelText('More resolve options')).toBeInTheDocument();
  });

  it('does not render more resolve options', () => {
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        onUpdate={spy}
        hasRelease={false}
        project={project}
        disableResolveInRelease
      />
    );
    expect(screen.queryByLabelText('More resolve options')).not.toBeInTheDocument();
  });

  it('does render next release option with subtitle', async () => {
    const onUpdate = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture()],
    });
    render(
      <ResolveActions
        hasSemverReleaseFeature={false}
        hasRelease
        project={releaseProject}
        onUpdate={onUpdate}
      />
    );

    await userEvent.click(screen.getByLabelText('More resolve options'));
    expect(await screen.findByText('The next release')).toBeInTheDocument();
    expect(
      await screen.findByText('The next release after the current one')
    ).toBeInTheDocument();
  });
});
