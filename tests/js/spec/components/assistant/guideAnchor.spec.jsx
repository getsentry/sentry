import React from 'react';

import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import GuideActions from 'app/actions/guideActions';
import ConfigStore from 'app/stores/configStore';
import theme from 'app/utils/theme';

describe('GuideAnchor', function() {
  let wrapper, wrapper2;
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

    wrapper = mountWithTheme(<GuideAnchor target="issue_title" />, routerContext);
    wrapper2 = mountWithTheme(<GuideAnchor target="exception" />, routerContext);
  });

  afterEach(function() {
    wrapper.unmount();
    wrapper2.unmount();
  });

  it('renders, advances, and finishes', async function() {
    GuideActions.fetchSucceeded(serverGuide);
    await tick();
    wrapper.update();

    // has old content and design without experiment
    expect(wrapper.find('Hovercard').exists()).toBe(true);
    expect(wrapper.find('StyledTitle').text()).toBe('Issue Details');
    expect(wrapper.find('Hovercard').prop('tipColor')).toBe(theme.greenDark);

    // Clicking on next should deactivate the current card and activate the next one.
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    await tick();
    wrapper.update();
    wrapper2.update();
    expect(wrapper.state('active')).toBeFalsy();
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
    wrapper.update();

    const dismissMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/assistant/',
    });
    wrapper
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
    expect(wrapper.state('active')).toBeFalsy();
  });

  it('renders no container when inactive', function() {
    wrapper = shallow(
      <GuideAnchor target="target 1">
        <span>A child</span>
      </GuideAnchor>
    );

    const component = wrapper.instance();
    wrapper.update();
    expect(component.state).toMatchObject({active: false});
    expect(wrapper.find('Hovercard').exists()).toBe(false);
  });

  it('has new content and design with experiment', async function() {
    ConfigStore.config = {
      user: {
        isSuperuser: false,
        dateJoined: new Date(2020, 0, 1),
        experiments: {AssistantGuideExperiment: 1},
      },
    };

    GuideActions.fetchSucceeded(serverGuide);
    await tick();
    wrapper.update();

    expect(wrapper.find('Hovercard').exists()).toBe(true);
    expect(wrapper.find('GuideTitle').text()).toBe("Let's Get This Over With");
    expect(wrapper.find('Hovercard').prop('tipColor')).toBe(theme.purple);
  });
});
