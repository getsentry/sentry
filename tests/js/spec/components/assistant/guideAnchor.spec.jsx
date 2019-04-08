import React from 'react';
import {shallow} from 'enzyme';
import GuideAnchor from 'app/components/assistant/guideAnchor';

describe('GuideAnchor', function() {
  const data = {
    currentGuide: {steps: [{message: 'abc', target: 'target 1', title: 'title 1'}]},
    currentStep: 1,
    anchors: null,
    guides: [],
    guidesSeen: new Set(),
  };

  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const component = shallow(<GuideAnchor target="target 1" type="text" />);
    expect(component).toMatchSnapshot();
  });

  it('turns active when guide state changes', function() {
    const wrapper = shallow(<GuideAnchor target="target 1" type="text" />);
    const component = wrapper.instance();
    component.onGuideStateChange(data);
    wrapper.update();
    expect(component.state).toEqual({active: true});
    expect(wrapper).toMatchSnapshot();
  });

  it('renders no container when inactive', function() {
    const wrapper = shallow(
      <GuideAnchor target="target 1" type="text">
        <span>A child</span>
      </GuideAnchor>
    );
    const component = wrapper.instance();
    wrapper.update();
    expect(component.state).toEqual({active: false});
    expect(wrapper.find('GuideAnchorContainer')).toHaveLength(0);
  });
});
