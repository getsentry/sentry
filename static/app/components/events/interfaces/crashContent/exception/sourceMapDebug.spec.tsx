import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Event, ExceptionValue} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {SourceMapDebug} from './sourceMapDebug';
import {
  getUniqueFilesFromException,
  SourceMapDebugError,
  SourceMapProcessingIssueType,
} from './useSourceMapDebug';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('SourceMapDebug', () => {
  const organization = TestStubs.Organization({});
  const project = TestStubs.Project();
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
            errors: null,
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
  const event: Event = {
    ...TestStubs.Event(),
    id: eventId,
    sdk: {
      name: sdkName,
    },
  } as Event;

  it('should use unqiue in app frames', async () => {
    expect(debugFrames).toHaveLength(1);
    expect(debugFrames[0].filename).toBe(
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
      'https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps-to-sentry'
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
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames'
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
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledTimes(1);

    expect(screen.getByText(textWithMarkupMatcher(expandedMessage))).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read Guide'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames'
    );
  });
});
