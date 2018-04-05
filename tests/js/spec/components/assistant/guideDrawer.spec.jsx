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

  it('gets dismissed', function() {
    let mock = jest.fn();
    let mock2 = jest.fn();
    let slug = 'test';
    let wrapper = shallow(
      <GuideDrawer
        guide={data}
        step={1}
        onFinish={mock}
        onDismiss={mock2}
        orgSlug={slug}
      />
    );
    expect(wrapper).toMatchSnapshot();
    wrapper
      .find('.close-button')
      .last()
      .simulate('click');
    expect(mock2).toHaveBeenCalled();
  });

  it('renders next step', function() {
    let mock = jest.fn();
    let mock2 = jest.fn();
    let slug = 'test';
    let wrapper = shallow(
      <GuideDrawer
        guide={data}
        step={2}
        onFinish={mock}
        onDismiss={mock2}
        orgSlug={slug}
      />
    );
    expect(wrapper).toMatchSnapshot();

    // Mark as useful.
    let usefulMock = Client.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
      data: {
        guide_id: 1,
        status: 'viewed',
        useful: true,
      },
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
