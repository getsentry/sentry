import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import OnboardingController from 'sentry/views/onboarding/onboardingController';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('OnboardingController', function () {
  it('Shows targeted onboarding with experiment active', function () {
    const {organization, router, routerContext} = initializeOrg({
      organization: {
        experiments: {
          TargetedOnboardingWelcomePageExperimentV2: 1,
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
          TargetedOnboardingWelcomePageExperimentV2: 0,
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
          TargetedOnboardingWelcomePageExperimentV2: 1,
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
  it('Shows targeted onboarding with multi-select experiment active', function () {
    const {organization, router, routerContext} = initializeOrg({
      organization: {
        experiments: {
          TargetedOnboardingMultiSelectExperiment: 1,
        },
      },
      router: {
        params: {
          step: 'setup-docs',
        },
      },
    });

    OrganizationStore.onUpdate(organization);
    const {container} = render(
      <OrganizationContext.Provider value={organization}>
        <PersistedStoreProvider>
          <OnboardingController {...router} />
        </PersistedStoreProvider>
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.getByTestId('targeted-onboarding')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
