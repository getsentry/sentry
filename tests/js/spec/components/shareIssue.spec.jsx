import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ShareIssue from 'app/components/shareIssue';

describe('ShareIssue', function() {
  it('renders when not shared', function() {
    const wrapper = shallow(
      <ShareIssue isSharing={false} onToggle={() => {}} onShare={() => {}} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when shared ', function() {
    const wrapper = shallow(
      <ShareIssue
        isSharing
        onToggle={() => {}}
        onShare={() => {}}
        shareUrl="http://sentry.io/share/test/"
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when busy', function() {
    const wrapper = shallow(<ShareIssue onToggle={() => {}} onShare={() => {}} busy />);
    expect(wrapper).toMatchSnapshot();
  });
});
