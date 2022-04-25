import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';

describe('InboxReason', () => {
  let inbox;
  beforeEach(() => {
    inbox = {
      reason: 0,
      date_added: new Date(),
      reason_details: null,
    };
  });

  it('displays new issue inbox reason', () => {
    render(<InboxReason inbox={inbox} />);
    expect(screen.getByText('New Issue')).toBeInTheDocument();
  });

  it('displays time added to inbox', () => {
    render(<InboxReason showDateAdded inbox={inbox} />);
    // Use a pattern so we can work around slowness between beforeEach and here.
    expect(screen.getByText(/\d+(s|ms|m)/i)).toBeInTheDocument();
  });

  it('has a tooltip', async () => {
    render(<InboxReason inbox={inbox} />);
    const tag = screen.getByText('New Issue');
    userEvent.hover(tag);

    expect(
      await screen.findByText('Mark Reviewed to remove this label')
    ).toBeInTheDocument();
  });

  it('has affected user count', async () => {
    render(
      <InboxReason
        inbox={{
          ...inbox,
          reason: 1,
          reason_details: {
            count: null,
            until: null,
            user_count: 10,
            user_window: null,
            window: null,
          },
        }}
      />
    );
    const tag = screen.getByText('Unignored');
    userEvent.hover(tag);

    // Text is split up because of translations
    expect(await screen.findByText('Affected')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('user(s)')).toBeInTheDocument();
  });
});
