import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';

describe('RawDownloadAction', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  it('includes the active thread id in native raw download links', () => {
    render(
      <StackTraceViewStateProvider
        defaultView="raw"
        hasMinifiedStacktrace
        defaultIsMinified
        platform="cocoa"
      >
        <RawDownloadAction
          eventId="event-id"
          organization={organization}
          projectSlug="project-slug"
          threadId={123}
        />
      </StackTraceViewStateProvider>
    );

    expect(screen.getByRole('button', {name: 'Download'})).toHaveAttribute(
      'href',
      '/projects/org-slug/project-slug/events/event-id/apple-crash-report?minified=true&thread_id=123&download=1'
    );
  });
});
