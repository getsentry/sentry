import React from 'react';
import {shallow} from 'enzyme';
import {Client} from 'app/api';
import GuideDrawer from 'app/components/assistant/guideDrawer';

describe('GuideDrawer', function() {
  let sandbox;
  let data = {
    cue: 'Click here for a tour of the issue page',
    id: 1,
    page: 'issue',
    required_targets: ['target 1'],
    steps: [{message: 'Message 1', target: 'target 1', title: '1. Title 1'}],
  };

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    Client.clearMockResponses();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders with first step', function() {
    let mock = jest.fn();
    let wrapper = shallow(<GuideDrawer guide={data} onClose={mock} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should mark as useful at end of the guide', function() {
    let mock = jest.fn();
    let usefulMock = Client.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
      data: {
        guide_id: 1,
        status: 'viewed',
        useful: false,
      },
    });
    let wrapper = shallow(<GuideDrawer guide={data} onClose={mock} />);
    let component = wrapper.instance();
    expect(usefulMock).not.toHaveBeenCalled();
    component.handleUseful(true);
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

  it('should mark guide as dismissed', function() {
    let mock = jest.fn();
    let dismissMock = Client.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
      data: {
        guide_id: 1,
        status: 'dismissed',
      },
    });
    let wrapper = shallow(<GuideDrawer guide={data} onClose={mock} />);
    let component = wrapper.instance();
    expect(dismissMock).not.toHaveBeenCalled();
    component.handleDismiss();
    expect(dismissMock).toHaveBeenCalledWith(
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
});
