import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {ExceptionValue} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';

import {SourceMapDebug} from './sourceMapDebug';
import type {SourceMapDebugError} from './useSourceMapDebug';
import {
  getUniqueFilesFromException,
  SourceMapProcessingIssueType,
} from './useSourceMapDebug';

jest.mock('sentry/utils/analytics');

describe('SourceMapDebug', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const eventId = '1ec1bd65b0b1484b97162087a652421b';
  const exceptionValues: ExceptionValue[] = [
    {
      type: 'TypeError',
      value: "Cannot read properties of undefined (reading 'map')",
      mechanism: {
        type: 'generic',
        handled: true,
      },
      threadId: null,
      module: null,
      stacktrace: {
        frames: [
          {
            filename: './app/views/organizationStats/teamInsights/controls.tsx',
            absPath: 'webpack:///./app/views/organizationStats/teamInsights/controls.tsx',
            module: 'app/views/organizationStats/teamInsights/controls',
            package: null,
            platform: null,
            instructionAddr: null,
            symbolAddr: null,
            function: 'TeamStatsControls',
            rawFunction: null,
            symbol: null,
            context: [],
            lineNo: 53,
            colNo: 25,
            inApp: true,
            trust: null,
            vars: null,
            minGroupingLevel: 0,
          },
        ],
        framesOmitted: null,
        registers: null,
        hasSystemFrames: true,
      },
      rawStacktrace: {} as any,
    },
  ];
  const url = `/projects/${organization.slug}/${project.slug}/events/${eventId}/source-map-debug/`;
  const sdkName = 'sentry.javascript.browser';
  const debugFrames = getUniqueFilesFromException(exceptionValues, {
    orgSlug: organization.slug,
    projectSlug: project.slug,
    eventId,
  });
  const event = EventFixture({
    id: eventId,
    sdk: {
      name: sdkName,
    },
  });

  it('should use unqiue in app frames', () => {
    expect(debugFrames).toHaveLength(1);
    expect(debugFrames[0]!.filename).toBe(
      './app/views/organizationStats/teamInsights/controls.tsx'
    );
  });

  it('should show message for MISSING_RELEASE', async () => {
    MockApiClient.addMockResponse({
      url,
      body: {
        errors: [
          {
            type: SourceMapProcessingIssueType.MISSING_RELEASE,
            message: '',
            data: null,
          },
        ],
      },
      match: [MockApiClient.matchQuery({exception_idx: '0', frame_idx: '0'})],
    });

    render(<SourceMapDebug debugFrames={debugFrames} event={event} />, {
      organization,
    });
    expect(
      await screen.findByText(
        "We've encountered 1 problem un-minifying your applications source code!"
      )
    ).toBeInTheDocument();

    // Step 1
    expect(screen.getByText('Event missing Release tag')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read Guide'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps'
    );
  });

  it('should fill message with data for PARTIAL_MATCH', async () => {
    const error: SourceMapDebugError = {
      type: SourceMapProcessingIssueType.PARTIAL_MATCH,
      message: '',
      data: {
        absPath: 'insertPath',
        partialMatchPath: 'matchedSourcemapPath',
        urlPrefix: 'urlPrefix',
      },
    };
    MockApiClient.addMockResponse({
      url,
      body: {errors: [error]},
      match: [MockApiClient.matchQuery({exception_idx: '0', frame_idx: '0'})],
    });

    render(<SourceMapDebug debugFrames={debugFrames} event={event} />, {
      organization,
    });
    expect(
      await screen.findByText(
        "We've encountered 1 problem un-minifying your applications source code!"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('Partial Absolute Path Match', {exact: false})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read Guide'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods/#verify-artifact-names-match-stack-trace-frames'
    );
  });

  it('should expand URL_NOT_VALID description and emit an analytics event', async () => {
    const error: SourceMapDebugError = {
      type: SourceMapProcessingIssueType.URL_NOT_VALID,
      message: '',
      data: {absPath: 'absValue'},
    };
    MockApiClient.addMockResponse({
      url,
      body: {errors: [error]},
    });

    render(<SourceMapDebug debugFrames={debugFrames} event={event} />, {
      organization,
    });
    expect(
      await screen.findByText(
        "We've encountered 1 problem un-minifying your applications source code!"
      )
    ).toBeInTheDocument();

    const expandedMessage =
      'The abs_path of the stack frame is absValue which is not a valid URL. Read our docs for troubleshooting help.';
    expect(
      screen.queryByText(textWithMarkupMatcher(expandedMessage))
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(trackAnalytics).toHaveBeenCalledTimes(1);

    expect(screen.getByText(textWithMarkupMatcher(expandedMessage))).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read Guide'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods/#verify-artifact-names-match-stack-trace-frames'
    );
  });

  it('should show source maps wizard alert for DEBUG_ID_NO_SOURCEMAPS', async () => {
    const error: SourceMapDebugError = {
      type: SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS,
      message: '',
    };

    MockApiClient.addMockResponse({
      url,
      body: {errors: [error]},
    });

    render(<SourceMapDebug debugFrames={debugFrames} event={event} />, {
      organization,
    });

    expect(
      await screen.findByText("You're not a computer, so why parse minified code?")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Upload source maps with the Sentry Wizard to unlock readable stack traces and better error grouping. Learn more'
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('npx @sentry/wizard@latest -i sourcemaps'))
    ).toBeInTheDocument();
  });
});
