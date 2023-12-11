import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import RelocationOnboardingContainer from './index';

describe('Relocation Onboarding Container', function () {
  it('should render if feature enabled', function () {
    const {routerProps, routerContext, organization} = initializeOrg({
      router: {
        params: {step: '1'},
      },
    });
    ConfigStore.set('features', new Set(['relocation:enabled']));
    render(<RelocationOnboardingContainer {...routerProps} />, {
      context: routerContext,
      organization,
    });
    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });

  it('should not render if feature disabled', async function () {
    const {routerProps, routerContext, organization} = initializeOrg({
      router: {
        params: {step: '1'},
      },
    });
    ConfigStore.set('features', new Set([]));
    render(<RelocationOnboardingContainer {...routerProps} />, {
      context: routerContext,
      organization,
    });
    expect(
      await screen.queryByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });
});
