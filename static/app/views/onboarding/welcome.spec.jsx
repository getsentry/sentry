import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OnboardingWelcome from 'sentry/views/onboarding/welcome';

describe('OnboardingWelcome', function () {
  const {organization} = initializeOrg({});
  it('renders', function () {
    const name = 'Rick Sanchez';
    ConfigStore.loadInitialData({user: {name, options: {}}});

    render(<OnboardingWelcome organization={organization} />);
  });

  it('calls onComplete when progressing', function () {
    const onComplete = jest.fn();
    render(
      <OnboardingWelcome active onComplete={onComplete} organization={organization} />
    );

    userEvent.click(screen.getByRole('button', {name: 'Start'}));

    expect(onComplete).toHaveBeenCalled();
  });
});
