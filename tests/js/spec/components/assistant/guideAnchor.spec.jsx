import React from 'react';

import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import GuideActions from 'app/actions/guideActions';
import ConfigStore from 'app/stores/configStore';

describe('GuideAnchor', function() {
  let wrapper1, wrapper2;
  const serverGuide = [
    {
      guide: 'issue',
      seen: false,
    },
  ];

  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    ConfigStore.config = {
      user: {
        isSuperuser: false,
        dateJoined: new Date(2020, 0, 1),
      },
    };

    wrapper1 = mountWithTheme(<GuideAnchor target="issue_title" />, routerContext);
    wrapper2 = mountWithTheme(<GuideAnchor target="exception" />, routerContext);
  });

  afterEach(function() {
    wrapper1.unmount();
    wrapper2.unmount();
  });

  it('renders, advances, and finishes', async function() {
    GuideActions.fetchSucceeded(serverGuide);
    await tick();
    wrapper1.update();

    expect(wrapper1.find('Hovercard').exists()).toBe(true);
    expect(wrapper1.find('StyledTitle').text()).toBe('Issue Details');

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
    expect(wrapper2.find('Hovercard').exists()).toBe(true);
    expect(wrapper2.find('StyledTitle').text()).toBe('Stacktrace');

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
          guide: 'issue',
          status: 'viewed',
        },
      })
    );
  });

  it('dismisses', async function() {
    GuideActions.fetchSucceeded(serverGuide);
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
          guide: 'issue',
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
    expect(wrapper.find('Hovercard').exists()).toBe(false);
  });
});
