import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';

describe('GroupEventCarousel', () => {
  const testEvent = TestStubs.Event({
    id: 'event-id',
    size: 7,
    dateCreated: '2019-03-20T00:00:00.000Z',
    errors: [],
    entries: [],
    tags: [{key: 'environment', value: 'dev'}],
    previousEventID: 'prev-event-id',
    nextEventID: 'next-event-id',
  });

  const defaultProps = {
    event: testEvent,
    group: TestStubs.Group({id: 'group-id'}),
    projectSlug: 'project-slug',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
    window.open = jest.fn();
  });

  it('can navigate next/previous events', () => {
    render(<GroupEventCarousel {...defaultProps} />);

    expect(screen.getByLabelText(/Oldest/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/oldest/?referrer=oldest-event`
    );
    expect(screen.getByLabelText(/Older/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/prev-event-id/?referrer=previous-event`
    );
    expect(screen.getByLabelText(/Newer/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/next-event-id/?referrer=next-event`
    );
    expect(screen.getByLabelText(/Newest/)).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/group-id/events/latest/?referrer=latest-event`
    );
  });

  it('can copy event ID', () => {
    render(<GroupEventCarousel {...defaultProps} />);

    userEvent.click(screen.getByText(testEvent.id));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);
  });

  it('can copy event link', () => {
    render(<GroupEventCarousel {...defaultProps} />);

    userEvent.click(screen.getByRole('button', {name: /event actions/i}));
    userEvent.click(screen.getByRole('menuitemradio', {name: /copy event link/i}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/group-id/events/event-id/`
    );
  });

  it('links to full event details when org has discover', () => {
    render(<GroupEventCarousel {...defaultProps} />, {
      organization: TestStubs.Organization({features: ['discover-basic']}),
    });

    userEvent.click(screen.getByRole('button', {name: /event actions/i}));

    expect(
      within(screen.getByRole('menuitemradio', {name: /full event details/i})).getByRole(
        'link'
      )
    ).toHaveAttribute('href', `/organizations/org-slug/discover/project-slug:event-id/`);
  });

  it('can open event JSON', () => {
    render(<GroupEventCarousel {...defaultProps} />);

    userEvent.click(screen.getByRole('button', {name: /event actions/i}));
    userEvent.click(screen.getByRole('menuitemradio', {name: 'JSON (7 B)'}));

    expect(window.open).toHaveBeenCalledWith(
      `/api/0/projects/org-slug/project-slug/events/event-id/json/`
    );
  });
});
