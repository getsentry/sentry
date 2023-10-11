import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import type {
  BasePlatformOptions,
  Docs,
  SelectedPlatformOptions,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ReleaseRegistrySdk} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {DeepPartial} from 'sentry/types/utils';

interface Options<PlatformOptions extends BasePlatformOptions = BasePlatformOptions> {
  releaseRegistry?: DeepPartial<ReleaseRegistrySdk>;
  selectedOptions?: Partial<SelectedPlatformOptions<PlatformOptions>>;
  selectedProducts?: ProductSolution[];
}

export function renderWithOnboardingLayout<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>(docsConfig: Docs<PlatformOptions>, options: Options<PlatformOptions> = {}) {
  const {
    releaseRegistry = {},
    selectedProducts = [
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.PROFILING,
      ProductSolution.SESSION_REPLAY,
    ],
    selectedOptions = {},
  } = options;

  const {organization, routerContext} = initializeOrg({
    router: {
      location: {
        query: selectedOptions,
      },
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdks/`,
    body: releaseRegistry,
  });

  render(
    <OnboardingLayout
      docsConfig={docsConfig}
      projectSlug="test-project-slug"
      dsn="test-dsn"
      platformKey="java-spring-boot"
      projectId="test-project-id"
      activeProductSelection={selectedProducts}
    />,
    {
      organization,
      context: routerContext,
    }
  );
}
