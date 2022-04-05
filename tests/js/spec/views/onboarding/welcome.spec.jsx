import {mountWithTheme} from 'sentry-test/enzyme';

import LegacyConfigStore from 'sentry/stores/configStore';
import OnboardingWelcome from 'sentry/views/onboarding/welcome';

describe('OnboardingWelcome', function () {
  it('renders', function () {
    const name = 'Rick Snachez';
    LegacyConfigStore.loadInitialData({user: {name, options: {}}});

    mountWithTheme(<OnboardingWelcome />);
  });

  it('calls onComplete when progressing', function () {
    const onComplete = jest.fn();
    const wrapper = mountWithTheme(<OnboardingWelcome active onComplete={onComplete} />);

    wrapper.find('Button[priority="primary"]').first().simulate('click');

    expect(onComplete).toHaveBeenCalled();
  });
});
