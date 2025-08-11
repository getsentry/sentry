import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';

import {
  type FrameSourceMapDebuggerData,
  SourceMapsDebuggerModal,
  type SourceMapsDebuggerModalProps,
} from './sourceMapsDebuggerModal';

const defaultAnalyticsParams = {
  event_id: '12345',
  project_id: '1',
  organization: null,
};

const defaultSourceResolutionResults: FrameSourceMapDebuggerData = {
  debugIdProgress: 0,
  debugIdProgressPercent: 0,
  dist: null,
  eventHasDebugIds: false,
  frameIsResolved: false,
  hasScrapingData: false,
  matchingSourceFileNames: [],
  matchingSourceMapName: null,
  minDebugIdSdkVersion: null,
  release: null,
  releaseHasSomeArtifact: false,
  releaseProgress: 0,
  releaseProgressPercent: 0,
  releaseSourceMapReference: null,
  releaseUserAgent: null,
  scrapingProgress: 0,
  scrapingProgressPercent: 0,
  sdkDebugIdSupport: 'full',
  sdkName: null,
  sdkVersion: null,
  sourceFileReleaseNameFetchingResult: 'found' as const,
  sourceFileScrapingStatus: null,
  sourceMapReleaseNameFetchingResult: 'found' as const,
  sourceMapScrapingStatus: null,
  stackFrameDebugId: null,
  stackFramePath: null,
  uploadedSomeArtifactWithDebugId: false,
  uploadedSourceFileWithCorrectDebugId: false,
  uploadedSourceMapWithCorrectDebugId: false,
  projectPlatform: undefined,
};

const renderModal = async (props?: Partial<SourceMapsDebuggerModalProps>) => {
  renderGlobalModal();

  render(
    <button
      onClick={() =>
        openModal(modalProps => (
          <SourceMapsDebuggerModal
            analyticsParams={defaultAnalyticsParams}
            sourceResolutionResults={defaultSourceResolutionResults}
            projectId="1"
            {...props}
            {...modalProps}
          />
        ))
      }
    >
      Unminify Code
    </button>
  );

  await userEvent.click(screen.getByRole('button', {name: /unminify code/i}));

  await screen.findByText(/Make Your Stack Traces Readable/i);
};

describe('SourceMapsDebuggerModal', () => {
  it(`renders proper message when active tab is 'release', release has some
    artifact and release name fetching was unsuccessful`, async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        releaseProgressPercent: 100, // so the active tab is 'release'
        releaseHasSomeArtifact: true,
        sourceFileReleaseNameFetchingResult: 'unsuccessful' as const,
        sdkDebugIdSupport: 'not-supported',
      },
    });

    expect(screen.getByText(/This stack frame doesn't have a path/)).toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('hides all tabs - when full Debug ID support and no scraping data', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'full',
        hasScrapingData: false,
      },
    });

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('hides all tabs - when unsupported Debug ID and no scraping data', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'not-supported',
        hasScrapingData: false,
      },
    });

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('display tabs - except releases', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'full',
        hasScrapingData: true,
      },
    });

    expect(screen.getByRole('tab', {name: /debug ids/i})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: /releases/i})).not.toBeInTheDocument();
    expect(screen.getByRole('tab', {name: /hosting publicly/i})).toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('display tabs - except debug ids', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'not-supported',
        hasScrapingData: true,
      },
    });

    expect(screen.queryByRole('tab', {name: /debug ids/i})).not.toBeInTheDocument();
    expect(screen.getByRole('tab', {name: /releases/i})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: /hosting publicly/i})).toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });
});
