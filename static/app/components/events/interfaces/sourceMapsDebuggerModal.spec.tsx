import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

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

const renderModal = (props?: Partial<SourceMapsDebuggerModalProps>) => {
  renderGlobalModal();

  act(() => {
    openModal(
      modalProps => (
        <SourceMapsDebuggerModal
          analyticsParams={defaultAnalyticsParams}
          sourceResolutionResults={defaultSourceResolutionResults}
          {...props}
          {...modalProps}
        />
      ),
      {
        onClose: () => {},
      }
    );
  });
};

describe('SourceMapsDebuggerModal', () => {
  it(`renders proper message when active tab is 'release', release has some
  artifact and release name fetching was unsuccessful`, () => {
    const sourceResolutionResults = {
      ...defaultSourceResolutionResults,
      releaseProgressPercent: 100, // so the active tab is 'release'
      releaseHasSomeArtifact: true,
      sourceFileReleaseNameFetchingResult: 'unsuccessful' as const,
    };

    renderModal({sourceResolutionResults});

    expect(
      screen.getByText(
        "This stack frame doesn't have a path. Check your SDK configuration to send a stack frame path!"
      )
    ).toBeInTheDocument();
  });

  it('does not render "Debug IDs" tab if the SDK does not support it', function () {
    renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'not-supported',
      },
    });

    expect(screen.queryByRole('tab', {name: /debug ids/i})).not.toBeInTheDocument();
  });
  it('renders "Debug IDs" tab if the SDK does support it', function () {
    renderModal({
      sourceResolutionResults: {
        ...defaultSourceResolutionResults,
        sdkDebugIdSupport: 'full',
      },
    });

    expect(screen.getByRole('tab', {name: /debug ids/i})).toBeInTheDocument();
  });
});
