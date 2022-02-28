import {enzymeRender} from 'sentry-test/enzyme';

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
    const wrapper = enzymeRender(<InboxReason inbox={inbox} />);
    expect(wrapper.text()).toBe('New Issue');
  });

  it('displays time added to inbox', () => {
    const wrapper = enzymeRender(<InboxReason showDateAdded inbox={inbox} />);
    expect(wrapper.find('TimeSince').exists()).toBeTruthy();
  });

  it('has a tooltip', () => {
    const wrapper = enzymeRender(<InboxReason inbox={inbox} />);
    const tooltip = enzymeRender(wrapper.find('Tooltip').prop('title'));
    expect(tooltip.text()).toContain('Mark Reviewed to remove this label');
  });

  it('has affected user count', () => {
    const wrapper = enzymeRender(
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
    const tooltip = enzymeRender(wrapper.find('Tooltip').prop('title'));
    expect(tooltip.text()).toContain('Affected 10 user(s)');
  });
});
