import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExceptionValue} from 'sentry/types';

import {SourceMapDebug} from './sourceMapDebug';
import {getUnqiueFilesFromExcption} from './useSourceMapDebug';

describe('SourceMapDebug', () => {
  const organization = TestStubs.Organization({features: ['fix-source-map-cta']});
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
  const apiUrl = `/projects/${organization.slug}/${project.slug}/events/${eventId}/source-map-debug/`;
  const platform = 'javascript';
  const debugFrames = getUnqiueFilesFromExcption(exceptionValues, platform, {
    orgSlug: organization.slug,
    projectSlug: project.slug,
    eventId,
  });

  it('should use unqiue in app frames', () => {
    expect(debugFrames).toHaveLength(1);
    expect(debugFrames[0][0]).toBe(
      './app/views/organizationStats/teamInsights/controls.tsx'
    );
  });

  it('should show two messages for no_release_on_event', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: {
        errors: [
          {
            type: 'no_release_on_event',
            message: 'The absolute path url is not valid',
            data: null,
          },
        ],
      },
      match: [MockApiClient.matchQuery({exception_idx: '0', frame_idx: '0'})],
    });

    render(<SourceMapDebug debugFrames={debugFrames} platform={platform} />, {
      organization,
    });
    const alert = await screen.findByText(
      'We’ve encountered 2 problems de-minifying your applications source code!'
    );
    expect(alert).toBeInTheDocument();
    userEvent.click(alert);

    // Step 1
    expect(
      screen.getByText('Update your Sentry.init call to pass in the release argument')
    ).toBeInTheDocument();
    // Step 2
    expect(
      screen.getByText(/Integrate Sentry into your release pipeline/)
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', {name: 'Read Guide'});
    expect(links[0]).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/configuration/options/#release'
    );
    expect(links[1]).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps-to-sentry'
    );
  });
});
