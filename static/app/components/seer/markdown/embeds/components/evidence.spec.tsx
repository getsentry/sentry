import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';

function tag(name: string, data: Record<string, unknown>) {
  return `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
}

describe('Seer evidence embeds', () => {
  it('validates immutable evidence references', () => {
    expect(
      SEER_EMBED_SCHEMAS.event.schema.safeParse({event_id: 'event-id'}).success
    ).toBe(true);
    expect(SEER_EMBED_SCHEMAS.event.schema.safeParse({issue_id: '42'}).success).toBe(
      true
    );
    expect(SEER_EMBED_SCHEMAS.event.schema.safeParse({}).success).toBe(false);
    expect(
      SEER_EMBED_SCHEMAS.trace.schema.safeParse({
        trace_id: 'trace-id',
        span_id: 'span-id',
      }).success
    ).toBe(true);
  });

  it('keeps the legacy actor alias inline', () => {
    render(
      <SeerMarkdown
        raw={`Owner: ${tag('actor', {id: '1', type: 'team', name: 'platform'})}`}
      />
    );

    expect(screen.getByText('#platform')).toBeInTheDocument();
  });

  it('shows invalid block references instead of silently dropping them', () => {
    render(<SeerMarkdown raw={tag('event', {})} />);

    expect(
      screen.getByText('This evidence reference is invalid and could not be displayed.')
    ).toBeInTheDocument();
  });

  it('falls back safely when a profile has no project context', () => {
    render(<SeerMarkdown raw={tag('profile', {profile_id: 'profile-id'})} />);

    expect(
      screen.getByText('Project context was not included, so a preview is unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Sentry'})).toHaveAttribute(
      'href',
      expect.stringContaining('profile.id%3Aprofile-id')
    );
  });

  it('does not leak event identifiers when access is forbidden', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventids/secret-event/',
      statusCode: 403,
      body: {},
    });

    render(<SeerMarkdown raw={tag('event', {event_id: 'secret-event'})} />);

    expect(
      await screen.findByText("You don't have access to this evidence.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret-event/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Open in Sentry'})).not.toBeInTheDocument();
  });
});
