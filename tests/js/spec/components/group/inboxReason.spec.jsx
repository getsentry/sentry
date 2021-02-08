import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import InboxReason from 'app/components/group/inboxBadges/inboxReason';

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
    const wrapper = mountWithTheme(<InboxReason inbox={inbox} />);
    expect(wrapper.text()).toBe('New Issue');
  });

  it('displays time added to inbox', () => {
    const wrapper = mountWithTheme(<InboxReason showDateAdded inbox={inbox} />);
    expect(wrapper.find('TimeSince').exists()).toBeTruthy();
  });
});
