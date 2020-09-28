import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ShareIssue from 'app/components/shareIssue';

describe('ShareIssue', () => {
  it('renders when not shared', () => {
    const wrapper = mountWithTheme(
      <ShareIssue
        isShared={false}
        isBusy={false}
        onToggle={() => {}}
        onReshare={() => {}}
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders when shared', () => {
    const wrapper = mountWithTheme(
      <ShareIssue
        isShared
        isBusy={false}
        onToggle={() => {}}
        onReshare={() => {}}
        shareUrl="http://sentry.io/share/test/"
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders when busy', () => {
    const wrapper = mountWithTheme(
      <ShareIssue isBusy isShared={false} onToggle={() => {}} onReshare={() => {}} />
    );
    expect(wrapper).toSnapshot();
  });

  it('triggers onToggle callback', () => {
    const toggleFn = jest.fn();
    const wrapper = mountWithTheme(
      <ShareIssue
        isBusy={false}
        isShared={false}
        onToggle={toggleFn}
        onReshare={() => {}}
      />
    );
    wrapper.find('DropdownLink').simulate('click');
    wrapper.find('Switch').simulate('click');
    expect(toggleFn).toHaveBeenCalled();
  });
});
