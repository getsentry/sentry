import React from 'react';
import {shallow} from 'enzyme';
import {Client} from 'app/api';
import GuideDrawer from 'app/components/assistant/guideDrawer';

describe('GuideDrawer', function() {
  let data = {
    cue: 'Click here for a tour of the issue page',
    id: 1,
    page: 'issue',
    required_targets: ['target 1'],
    steps: [
      {message: 'Message 1 ${orgSlug}', target: 'target 1', title: '1. Title 1'},
      {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
    ],
  };

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/assistant/',
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });
  });

  it('renders drawer', function() {
    const wrapper = shallow(<GuideDrawer />);
    const component = wrapper.instance();
    component.onGuideStateChange({
      currentGuide: data,
      currentStep: 0,
    });
    wrapper.update();
    wrapper
      .find('.assistant-cue')
      .first()
      .simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('gets dismissed', function() {
    let wrapper = shallow(<GuideDrawer />);
    const component = wrapper.instance();
    component.onGuideStateChange({
      currentGuide: data,
      currentStep: 1,
      currentOrg: {slug: 'testorg'},
    });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();

    let closeMock = Client.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
    });
    wrapper
      .find('.close-button')
      .last()
      .simulate('click', {stopPropagation: () => {}});
    expect(closeMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide_id: 1,
          status: 'dismissed',
        },
      })
    );
  });

  it('renders next step', function() {
    let wrapper = shallow(<GuideDrawer />);
    const component = wrapper.instance();
    component.onGuideStateChange({
      currentGuide: data,
      currentStep: 2,
      currentOrg: {slug: 'testorg'},
    });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();

    // Mark as useful.
    let usefulMock = Client.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
    });
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(usefulMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide_id: 1,
          status: 'viewed',
          useful: true,
        },
      })
    );
  });
});
