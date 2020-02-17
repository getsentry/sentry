import React from 'react';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import GuideActions from 'app/actions/guideActions';
import ConfigStore from 'app/stores/configStore';

describe('GuideAnchor', function() {
  const guides = {
    guide1: {
      id: 1,
      required_targets: [],
      steps: [
        {message: 'abc', target: 'target 1', title: 'title 1'},
        {message: 'xyz', target: 'target 2', title: 'title 2'},
      ],
    },
  };

  const routerContext = TestStubs.routerContext();

  let wrapper1, wrapper2;

  beforeEach(function() {
    ConfigStore.config = {
      user: {
        isSuperuser: true,
      },
    };
    wrapper1 = mountWithTheme(<GuideAnchor target="target 1" />, routerContext);
    wrapper2 = mountWithTheme(<GuideAnchor target="target 2" />, routerContext);
  });

  afterEach(function() {
    wrapper1.unmount();
    wrapper2.unmount();
  });

  it('renders, advances, and finishes', async function() {
    const data = JSON.parse(JSON.stringify(guides)); // deep copy
    GuideActions.fetchSucceeded(data);
    await tick();
    wrapper1.update();
    expect(wrapper1).toMatchSnapshot();

    // Clicking on next should deactivate the current card and activate the next one.
    wrapper1
      .find('Button')
      .first()
      .simulate('click');
    await tick();
    wrapper1.update();
    wrapper2.update();
    expect(wrapper1.state('active')).toBeFalsy();
    expect(wrapper2.state('active')).toBeTruthy();
    expect(wrapper2).toMatchSnapshot();

    // Clicking on the button in the last step should finish the guide.
    const finishMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });
    wrapper2
      .find('Button')
      .last()
      .simulate('click');
    expect(finishMock).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          guide_id: 1,
          status: 'viewed',
        },
      })
    );
  });

  it('dismisses', async function() {
    const data = JSON.parse(JSON.stringify(guides)); // deep copy
    GuideActions.fetchSucceeded(data);
    await tick();
    wrapper1.update();

    const dismissMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });
    wrapper1
      .find('[data-test-id="close-button"]')
      .first()
      .simulate('click');
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
    await tick();
    expect(wrapper1.state('active')).toBeFalsy();
  });

  it('renders no container when inactive', function() {
    const wrapper = shallow(
      <GuideAnchor target="target 1">
        <span>A child</span>
      </GuideAnchor>
    );
    const component = wrapper.instance();
    wrapper.update();
    expect(component.state).toMatchObject({active: false});
    expect(wrapper.find('Hovercard')).toHaveLength(0);
  });
});
