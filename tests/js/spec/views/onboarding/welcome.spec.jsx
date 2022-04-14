import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ConfigStore from 'sentry/stores/configStore';
import OnboardingWelcome from 'sentry/views/onboarding/welcome';

describe('OnboardingWelcome', function () {
  const {organization} = initializeOrg({});
  it('renders', function () {
    const name = 'Rick Sanchez';
    ConfigStore.loadInitialData({user: {name, options: {}}});

    mountWithTheme(<OnboardingWelcome organization={organization} />);
  });

  it('calls onComplete when progressing', function () {
    const onComplete = jest.fn();
    const wrapper = mountWithTheme(
      <OnboardingWelcome active onComplete={onComplete} organization={organization} />
    );

    wrapper.find('Button[priority="primary"]').first().simulate('click');

    expect(onComplete).toHaveBeenCalled();
  });
});
