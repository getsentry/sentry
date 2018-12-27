import React from 'react';
import {shallow} from 'enzyme';
import ShareIssue from 'app/components/shareIssue';

describe('ShareIssue', function() {
  it('renders when not shared', function() {
    let wrapper = shallow(
      <ShareIssue isSharing={false} onToggle={() => {}} onShare={() => {}} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when shared ', function() {
    let wrapper = shallow(
      <ShareIssue
        isSharing={true}
        onToggle={() => {}}
        onShare={() => {}}
        shareUrl="http://sentry.io/share/test/"
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when busy', function() {
    let wrapper = shallow(
      <ShareIssue onToggle={() => {}} onShare={() => {}} busy={true} />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
