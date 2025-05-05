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
            orgSlug="org-slug"
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

  it('does not render "Debug IDs" tab if the SDK does not support it', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'not-supported',
      },
    });

    expect(screen.queryByRole('tab', {name: /debug ids/i})).not.toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('if SDK fully supports Debug IDs, renders "Debug IDs" tab as active', async function () {
    await renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'full',
      },
    });

    expect(screen.getByRole('tab', {name: /debug ids/i})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });
});
