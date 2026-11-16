import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreprodBuildDetailsWithSizeInfoFixture} from 'sentry-fixture/preprod';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import {BuildCompareHeaderContent} from './buildCompareHeaderContent';

describe('BuildCompareHeaderContent', () => {
  const organization = OrganizationFixture({slug: 'test-org'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({slug: 'test-project', platform: 'android'}),
    ]);
  });

  const completedSizeInfo = {
    state: BuildDetailsSizeAnalysisState.COMPLETED as const,
    size_metrics: [
      {
        metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
        install_size_bytes: 1024000,
        download_size_bytes: 512000,
      },
    ],
    base_size_metrics: [],
  };

  const buildDetails = PreprodBuildDetailsWithSizeInfoFixture(completedSizeInfo, {
    project_id: 123456,
    app_info: {
      version: '3.10',
      build_number: '100',
      name: 'Test App',
      app_id: 'com.test.app',
      artifact_type: null,
      build_configuration: null,
      date_added: undefined,
      date_built: null,
      platform: 'apple',
    },
  });

  it('renders breadcrumbs ending in the Compare Builds page title', () => {
    render(
      <BuildCompareHeaderContent
        buildDetails={buildDetails}
        headArtifactId="artifact-1"
      />,
      {organization}
    );

    expect(screen.getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'href',
      '/organizations/test-org/explore/releases/?project=123456&tab=mobile-builds'
    );
    expect(screen.getByRole('link', {name: 'artifact-1'})).toHaveAttribute(
      'href',
      '/organizations/test-org/preprod/size/artifact-1/'
    );

    // The crumb carries the project badge so it matches the page it leads back
    // to. The project is android; the build's own platform is apple, so this
    // icon can only be the crumb's.
    expect(screen.getByTestId('platform-icon-android')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: 'Compare Builds', level: 1})
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Compare Builds'})).not.toBeInTheDocument();
  });

  it('renders the shared build entity header', () => {
    render(
      <BuildCompareHeaderContent
        buildDetails={buildDetails}
        headArtifactId="artifact-1"
      />,
      {organization}
    );

    expect(
      screen.getByRole('heading', {name: 'Build version, v3.10 (100)', level: 2})
    ).toBeInTheDocument();

    const metadata = screen.getByRole('list', {name: 'Build properties'});
    expect(within(metadata).getByText('Test App')).toBeInTheDocument();
    expect(within(metadata).getByText('com.test.app')).toBeInTheDocument();
  });

  it('renders the size metrics as stats', async () => {
    render(
      <BuildCompareHeaderContent
        buildDetails={buildDetails}
        headArtifactId="artifact-1"
      />,
      {organization}
    );

    const stats = screen.getByRole('list', {name: 'Build size'});
    expect(within(stats).getByText('Install Size')).toBeInTheDocument();
    expect(within(stats).getByText('1.02 MB')).toBeInTheDocument();
    expect(within(stats).getByText('Bytes Transferred')).toBeInTheDocument();
    expect(within(stats).getByText('512 kB')).toBeInTheDocument();

    await userEvent.hover(within(stats).getByText('Install Size'));
    expect(await screen.findByText('Unencrypted install size')).toBeInTheDocument();

    await userEvent.hover(within(stats).getByText('Bytes Transferred'));
    expect(await screen.findByText('Over the network')).toBeInTheDocument();
  });

  it('phrases the install size stat for the build platform', async () => {
    const androidBuild = PreprodBuildDetailsWithSizeInfoFixture(completedSizeInfo, {
      project_id: 123456,
      app_info: {...buildDetails.app_info, platform: 'android'},
    });

    render(
      <BuildCompareHeaderContent
        buildDetails={androidBuild}
        headArtifactId="artifact-1"
      />,
      {organization}
    );

    // The Apple build above reads "Install Size"; AOT DEX is an Android
    // concept, so only this build may mention it.
    const stats = screen.getByRole('list', {name: 'Build size'});
    expect(within(stats).getByText('Uncompressed Disk Size')).toBeInTheDocument();
    expect(within(stats).queryByText('Install Size')).not.toBeInTheDocument();

    await userEvent.hover(within(stats).getByText('Uncompressed Disk Size'));
    expect(await screen.findByText('Excluding AOT DEX')).toBeInTheDocument();
  });

  it('holds the stats row while the build details request is in flight', () => {
    render(<BuildCompareHeaderContent headArtifactId="artifact-1" isLoading />, {
      organization,
    });

    // Declared rather than resolved, so the header's grid template — and the
    // page below it — does not reflow once the sizes land.
    expect(screen.getByRole('list', {name: 'Build size'})).toBeInTheDocument();
  });

  it('omits the stats row when size analysis has not completed', () => {
    const pendingBuild = PreprodBuildDetailsWithSizeInfoFixture(
      {state: BuildDetailsSizeAnalysisState.PENDING},
      {project_id: 123456}
    );

    render(
      <BuildCompareHeaderContent
        buildDetails={pendingBuild}
        headArtifactId="artifact-1"
      />,
      {organization}
    );

    expect(screen.queryByRole('list', {name: 'Build size'})).not.toBeInTheDocument();
  });

  it('hides the admin menu from non-employees', () => {
    render(
      <BuildCompareHeaderContent
        buildDetails={buildDetails}
        headArtifactId="artifact-1"
        baseArtifactId="artifact-2"
      />,
      {organization}
    );

    expect(
      screen.queryByRole('button', {name: 'Comparison Actions'})
    ).not.toBeInTheDocument();
  });
});
