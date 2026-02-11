import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, type RouterConfig} from 'sentry-test/reactTestingLibrary';

import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import type {
  BasePlatformOptions,
  Docs,
  SelectedPlatformOptions,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ReleaseRegistrySdk} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import type {Organization} from 'sentry/types/organization';
import type {DeepPartial} from 'sentry/types/utils';

interface Options<PlatformOptions extends BasePlatformOptions = BasePlatformOptions> {
  releaseRegistry?: DeepPartial<ReleaseRegistrySdk>;
  selectedOptions?: Partial<SelectedPlatformOptions<PlatformOptions>>;
  selectedProducts?: ProductSolution[];
}

type RenderOptions = {
  organization?: Organization;
};

export function renderWithOnboardingLayout<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>(
  docsConfig: Docs<PlatformOptions>,
  options: Options<PlatformOptions> = {},
  renderOptions: RenderOptions = {}
) {
  const {
    releaseRegistry = {},
    selectedProducts = [
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.PROFILING,
      ProductSolution.SESSION_REPLAY,
    ],
    selectedOptions = {},
  } = options;

  const organization = OrganizationFixture(renderOptions.organization);
  const project = ProjectFixture({organization});

  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`,
      query: selectedOptions,
    },
    route: `/organizations/:orgId/projects/:projectId/getting-started/`,
  };

  const projectKey = 'test-project-key-id';

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdks/`,
    body: releaseRegistry,
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/keys/${projectKey}/`,
    method: 'PUT',
    body: [ProjectKeysFixture()[0]],
  });

  render(
    <OnboardingLayout
      docsConfig={docsConfig}
      project={project}
      dsn={{
        public: 'test-dsn',
        secret: 'test-secret',
        cdn: 'test-cdn',
        crons: 'test-crons',
        security: 'test-security',
        csp: 'test-csp',
        minidump: 'test-minidump',
        unreal: 'test-unreal',
        playstation: 'test-playstation',
        integration: 'test-integration',
        otlp_traces: 'test-otlp_traces',
        otlp_logs: 'test-otlp_logs',
      }}
      platformKey={project.platform ?? 'other'}
      activeProductSelection={selectedProducts}
      projectKeyId={projectKey}
    />,
    {
      organization,
      initialRouterConfig,
    }
  );
}
