import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  SourceMapDebugFrameFixture,
  SourceMapDebugReleaseProcessFixture,
  SourceMapDebugResponseFixture,
} from 'sentry-fixture/sourceMapDebug';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {useSourceMapDebugQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';

import {DiagnosisSection} from './diagnosisSection';

const PROJECT_SLUG = 'project-slug';
const EVENT_ID = 'event-abc123';

function TestWrapper() {
  const sourceMapQuery = useSourceMapDebugQuery(
    PROJECT_SLUG,
    EVENT_ID,
    'sentry.javascript.browser'
  );
  return <DiagnosisSection sourceMapQuery={sourceMapQuery} />;
}

describe('DiagnosisSection', () => {
  const organization = OrganizationFixture();
  const apiUrl = `/projects/${organization.slug}/${PROJECT_SLUG}/events/${EVENT_ID}/source-map-debug-blue-thunder-edition/`;

  it('shows error state when the API call fails', async () => {
    MockApiClient.addMockResponse({url: apiUrl, statusCode: 500, body: {}});

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        'Unable to load source map diagnostic information for this event.'
      )
    ).toBeInTheDocument();
  });

  it('shows upload instructions when no artifacts exist for the project', async () => {
    MockApiClient.addMockResponse({url: apiUrl, body: SourceMapDebugResponseFixture()});

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        'No source map artifacts have been uploaded for this project.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Upload Instructions'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/'
    );
  });

  it('includes the release in the no-artifacts message when a release is set', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({release: '2.5.0'}),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'No source map artifacts have been uploaded for this project in release 2.5.0.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows dist mismatch message when the source file dist does not match', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                release_process: SourceMapDebugReleaseProcessFixture({
                  source_file_lookup_result: 'wrong-dist',
                }),
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'The source file ~/static/app.min.js was found but the dist value does not match the uploaded artifact.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows dist mismatch message when the source map dist does not match', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                release_process: SourceMapDebugReleaseProcessFixture({
                  source_map_reference: 'app.min.js.map',
                  source_map_lookup_result: 'wrong-dist',
                }),
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'The source map app.min.js.map was found but the dist value does not match the uploaded artifact.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows not-found message when the source file is missing and has no source map reference', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                release_process: SourceMapDebugReleaseProcessFixture({
                  source_file_lookup_result: 'unsuccessful',
                }),
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'The source file ~/static/app.min.js could not be found in any uploaded artifact bundle. No source map reference was detected.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows not-found message when the source map reference cannot be resolved', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                release_process: SourceMapDebugReleaseProcessFixture({
                  source_map_reference: 'app.min.js.map',
                  source_map_lookup_result: 'unsuccessful',
                }),
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'The source map referenced by ~/static/app.min.js points to app.min.js.map, but no matching artifact was found.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows scraping failure message when Sentry cannot fetch the source file', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                scraping_process: {
                  source_file: {
                    status: 'failure',
                    url: 'https://example.com/app.js',
                    reason: 'not_found',
                  },
                  source_map: null,
                },
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Sentry could not fetch the source file at https://example.com/app.js: not_found.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows scraping failure message when Sentry cannot fetch the source map', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        project_has_some_artifact_bundle: true,
        has_scraping_data: true,
        exceptions: [
          {
            frames: [
              SourceMapDebugFrameFixture({
                scraping_process: {
                  source_file: {status: 'success', url: 'https://example.com/app.js'},
                  source_map: {
                    status: 'failure',
                    url: 'https://example.com/app.js.map',
                    reason: 'timeout',
                  },
                },
              }),
            ],
          },
        ],
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Sentry could not fetch the source map at https://example.com/app.js.map: timeout.'
        )
      )
    ).toBeInTheDocument();
  });

  it('shows fallback message when source maps are present but issue cannot be pinpointed', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: SourceMapDebugResponseFixture({
        project_has_some_artifact_bundle: true,
        release_has_some_artifact: true,
      }),
    });

    render(<TestWrapper />, {organization});

    expect(
      await screen.findByText(
        'Source maps appear to be configured but Sentry could not pinpoint the exact issue.'
      )
    ).toBeInTheDocument();
  });
});
