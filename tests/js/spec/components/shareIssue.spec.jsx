import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ShareIssue from 'app/components/shareIssue';

describe('ShareIssue', () => {
  it('renders when not shared', () => {
    const wrapper = mountWithTheme(
      <ShareIssue
        isShared={false}
        loading={false}
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
        loading={false}
        onToggle={() => {}}
        onReshare={() => {}}
        shareUrl="http://sentry.io/share/test/"
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders when busy', () => {
    const wrapper = mountWithTheme(
      <ShareIssue loading isShared={false} onToggle={() => {}} onReshare={() => {}} />
    );
    expect(wrapper).toSnapshot();
  });

  it('call onToggle on open', () => {
    const toggleFn = jest.fn();
    const wrapper = mountWithTheme(
      <ShareIssue
        isShared={false}
        loading={false}
        onToggle={toggleFn}
        onReshare={() => {}}
      />
    );
    wrapper.find('.dropdown-actor').simulate('click');
    expect(toggleFn).toHaveBeenCalledTimes(1);
  });

  it('call onToggle on switch', () => {
    const toggleFn = jest.fn();
    const wrapper = mountWithTheme(
      <ShareIssue
        isShared={false}
        loading={false}
        onToggle={toggleFn}
        onReshare={() => {}}
      />
    );
    wrapper.find('.dropdown-actor').simulate('click');
    expect(toggleFn).toHaveBeenCalledTimes(1);
    wrapper.find('Switch').simulate('click');
    expect(toggleFn).toHaveBeenCalledTimes(2);
  });
});
