import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import OnboardingWelcome from 'app/views/onboarding/welcome';

describe('OnboardingWelcome', function () {
  it('renders', function () {
    const name = 'Rick Snachez';
    ConfigStore.loadInitialData({user: {name, options: {}}});

    mountWithTheme(<OnboardingWelcome />, TestStubs.routerContext());
  });

  it('calls onComplete when progressing', function () {
    const onComplete = jest.fn();
    const wrapper = mountWithTheme(
      <OnboardingWelcome active onComplete={onComplete} />,
      TestStubs.routerContext()
    );

    wrapper.find('Button[priority="primary"]').first().simulate('click');

    expect(onComplete).toHaveBeenCalled();
  });
});
