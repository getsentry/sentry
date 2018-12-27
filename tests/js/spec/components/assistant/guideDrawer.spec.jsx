import React from 'react';

import {GuideDrawer} from 'app/components/assistant/guideDrawer';
import {shallow} from 'enzyme';

describe('GuideDrawer', function() {
  let guides = [
    {
      cue: 'Click here for a tour of the issue page',
      id: 1,
      required_targets: ['target 1'],
      steps: [
        {message: 'Message 1 ${orgSlug}', target: 'target 1', title: '1. Title 1'},
        {message: 'Message 2', target: 'target 2', title: '2. Title 2'},
      ],
    },
    {
      id: 2,
      guide_type: 'tip',
      cta_text: 'cta_text',
      cta_link: '/cta/link/${orgSlug}/${projectSlug}/',
      required_targets: ['target 3'],
      steps: [
        {message: 'Message 1 ${numEvents}', target: 'target 3', title: '1. Title 1'},
      ],
    },
  ];
  let wrapper, component, closeMock, pushMock;

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: guides,
    });
    closeMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });
    pushMock = jest.fn();
    wrapper = shallow(
      <GuideDrawer
        router={{
          push: pushMock,
        }}
      />,
      {
        context: {
          router: TestStubs.router(),
          organization: {
            id: '100',
          },
        },
      }
    );
    component = wrapper.instance();
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders tip', async function() {
    component.onGuideStateChange({
      currentGuide: guides[1],
      currentStep: 1,
      project: {id: '10', slug: 'testproj'},
      projectStats: new Map([[10, 56]]),
      org: {slug: 'testorg'},
    });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();
    // Click on the CTA.
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(pushMock).toHaveBeenCalledWith('/cta/link/testorg/testproj/');
  });

  it('renders drawer', function() {
    component.onGuideStateChange({
      currentGuide: guides[0],
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
    component.onGuideStateChange({
      currentGuide: guides[0],
      currentStep: 1,
      org: {slug: 'testorg'},
    });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();

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
    component.onGuideStateChange({
      currentGuide: guides[0],
      currentStep: 2,
      org: {slug: 'testorg'},
    });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();

    // Mark as useful.
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(closeMock).toHaveBeenCalledWith(
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
