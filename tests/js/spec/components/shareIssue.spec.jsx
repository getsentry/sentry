import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ShareIssue from 'app/components/shareIssue';

describe('ShareIssue', function() {
  it('renders when not shared', function() {
    const wrapper = mountWithTheme(
      <ShareIssue isSharing={false} onToggle={() => {}} onShare={() => {}} />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders when shared ', function() {
    const wrapper = mountWithTheme(
      <ShareIssue
        isSharing
        onToggle={() => {}}
        onShare={() => {}}
        shareUrl="http://sentry.io/share/test/"
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders when busy', function() {
    const wrapper = mountWithTheme(
      <ShareIssue onToggle={() => {}} onShare={() => {}} busy />
    );
    expect(wrapper).toSnapshot();
  });
});
