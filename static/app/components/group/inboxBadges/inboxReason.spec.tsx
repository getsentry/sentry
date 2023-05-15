import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import {GroupInboxReason, GroupSubstatus} from 'sentry/types';

describe('InboxReason', () => {
  const inbox = {
    reason: GroupInboxReason.NEW,
    date_added: new Date().toISOString(),
    reason_details: {},
  };

  it('displays new issue inbox reason', () => {
    render(<InboxReason inbox={inbox} />);
    expect(screen.getByText('New Issue')).toBeInTheDocument();
  });

  it('displays time added to inbox', () => {
    render(<InboxReason showDateAdded inbox={inbox} />);
    // Use a pattern so we can work around slowness between beforeEach and here.
    expect(screen.getByText(/\d+(s|ms|m)/i)).toBeInTheDocument();
  });

  it('displays archived until escalating', async () => {
    render(
      <InboxReason
        inbox={{
          reason: 'archived',
          reason_details: {substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING},
          date_added: inbox.date_added,
        }}
      />
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('Archived'));
    expect(await screen.findByText('Archived until escalating')).toBeInTheDocument();
  });

  it('has a tooltip', async () => {
    render(<InboxReason inbox={inbox} />);
    const tag = screen.getByText('New Issue');
    await userEvent.hover(tag);

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
    await userEvent.hover(tag);

    expect(await screen.findByText('Affected 10 user(s)')).toBeInTheDocument();
  });
});
