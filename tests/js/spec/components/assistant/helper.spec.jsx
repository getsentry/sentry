import React from 'react';
import {shallow} from 'enzyme';
import AssistantHelper from 'app/components/assistant/helper';

describe('Helper', function() {
  it('renders cue', function() {
    let wrapper = shallow(<AssistantHelper />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders support drawer', function() {
    let wrapper = shallow(<AssistantHelper />);
    wrapper
      .find('.assistant-cue')
      .first()
      .simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders guide drawer', function() {
    const wrapper = shallow(<AssistantHelper />);
    const component = wrapper.instance();
    component.onGuideStateChange({
      currentGuide: {
        cue: 'Click here for a tour of the issue page',
        id: 1,
        page: 'issue',
        required_targets: ['target 1'],
        steps: [
          {message: 'Message 1', target: 'target 1', title: '1. Title 1'},
          {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
        ],
      },
      currentStep: 1,
    });
    wrapper
      .find('.assistant-cue')
      .first()
      .simulate('click');
    expect(wrapper).toMatchSnapshot();
  });
});
