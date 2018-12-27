import React from 'react';
import {shallow, mount} from 'enzyme';
import IssueSyncListElement from 'app/components/issueSyncListElement';

describe('AlertLink', function() {
  it('renders', function() {
    let wrapper = shallow(<IssueSyncListElement integrationType="github" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('can open', function() {
    let onOpen = jest.fn();
    let wrapper = shallow(
      <IssueSyncListElement integrationType="github" onOpen={onOpen} />
    );
    expect(onOpen).not.toHaveBeenCalled();
    wrapper.find('IntegrationLink').simulate('click');
    expect(onOpen).toHaveBeenCalled();
  });

  it('can close', function() {
    let onClose = jest.fn();
    let onOpen = jest.fn();

    let wrapper = mount(
      <IssueSyncListElement
        integrationType="github"
        externalIssueLink="github.com/issues/gh-101"
        externalIssueId={101}
        onClose={onClose}
        onOpen={onOpen}
      />
    );

    expect(onClose).not.toHaveBeenCalled();
    wrapper.find('OpenCloseIcon').simulate('click');
    expect(onClose).toHaveBeenCalled();
  });
});
