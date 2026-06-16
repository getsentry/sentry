import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';

function makeDocsConfig(overrides: Partial<OnboardingConfig> = {}): Docs {
  const base: OnboardingConfig = {
    install: () => [
      {
        type: StepType.INSTALL,
        content: [{type: 'text', text: 'Install the SDK'}],
      },
    ],
    configure: () => [],
    verify: () => [],
    ...overrides,
  };
  return {onboarding: base};
}

function renderLayout(docsConfig: Docs, features: string[] = []) {
  const organization = OrganizationFixture({features});
  const project = ProjectFixture({organization});

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdks/`,
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/keys/test-key/`,
    method: 'PUT',
    body: [],
  });

  return render(
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
      platformKey="javascript"
      projectKeyId="test-key"
    />,
    {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`,
        },
        route: '/organizations/:orgId/projects/:projectId/getting-started/',
      },
    }
  );
}

describe('OnboardingLayout', () => {
  describe('hideInstructionsCopy', () => {
    const COPY_FEATURE = 'onboarding-copy-setup-instructions-project-creation';

    it('shows copy instructions button when feature flag is enabled', () => {
      renderLayout(makeDocsConfig(), [COPY_FEATURE]);
      expect(screen.getByRole('button', {name: 'Copy instructions'})).toBeInTheDocument();
    });

    it('hides copy instructions button when hideInstructionsCopy is set', () => {
      renderLayout(makeDocsConfig({hideInstructionsCopy: true}), [COPY_FEATURE]);
      expect(
        screen.queryByRole('button', {name: 'Copy instructions'})
      ).not.toBeInTheDocument();
    });

    it('hides copy instructions button when feature flag is not enabled', () => {
      renderLayout(makeDocsConfig());
      expect(
        screen.queryByRole('button', {name: 'Copy instructions'})
      ).not.toBeInTheDocument();
    });
  });
});
