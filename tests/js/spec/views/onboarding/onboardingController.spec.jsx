import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import OnboardingController from 'sentry/views/onboarding/onboardingController';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('Onboarding', function () {
  it('Shows targeted onboarding with experiment active', function () {
    const {organization, router, routerContext} = initializeOrg({
      organization: {
        experiments: {
          TargetedOnboardingWelcomePageExperiment: 1,
        },
      },
      router: {
        params: {
          step: 'welcome',
        },
      },
    });

    const {container} = render(
      <OrganizationContext.Provider value={organization}>
        <OnboardingController {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.getByTestId('targeted-onboarding')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('Shows legacy onboarding without experiment', function () {
    const {organization, router, routerContext} = initializeOrg({
      organization: {
        experiments: {
          TargetedOnboardingWelcomePageExperiment: 0,
        },
      },
      router: {
        params: {
          step: 'welcome',
        },
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <OnboardingController {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.queryByTestId('targeted-onboarding')).not.toBeInTheDocument();
  });
  it('Shows legacy onboarding for second step', function () {
    const {organization, router, routerContext} = initializeOrg({
      organization: {
        experiments: {
          TargetedOnboardingWelcomePageExperiment: 1,
        },
      },
      router: {
        params: {
          step: 'select-platform',
        },
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <OnboardingController {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.queryByTestId('targeted-onboarding')).not.toBeInTheDocument();
  });
});
