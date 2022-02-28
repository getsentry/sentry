import {enzymeRender} from 'sentry-test/enzyme';

import ConfigStore from 'sentry/stores/configStore';
import OnboardingWelcome from 'sentry/views/onboarding/welcome';

describe('OnboardingWelcome', function () {
  it('renders', function () {
    const name = 'Rick Snachez';
    ConfigStore.loadInitialData({user: {name, options: {}}});

    enzymeRender(<OnboardingWelcome />);
  });

  it('calls onComplete when progressing', function () {
    const onComplete = jest.fn();
    const wrapper = enzymeRender(<OnboardingWelcome active onComplete={onComplete} />);

    wrapper.find('Button[priority="primary"]').first().simulate('click');

    expect(onComplete).toHaveBeenCalled();
  });
});
