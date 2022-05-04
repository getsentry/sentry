import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import OnboardingController from 'sentry/views/onboarding/onboardingController';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('OnboardingController', function () {
  it('Shows targeted onboarding', function () {
    const {organization, router, routerContext} = initializeOrg({
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
