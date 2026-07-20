import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import {ScmFeatureSelectionPanel} from './scmFeatureSelectionPanel';

const pythonPlatform: OnboardingSelectedSDK = {
  key: 'python',
  name: 'Python',
  language: 'python',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/python/',
  category: 'popular',
};

function defaultProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    analyticsFlow: 'onboarding' as const,
    selectedRepository: undefined,
    selectedPlatform: pythonPlatform,
    selectedFeatures: [ProductSolution.ERROR_MONITORING],
    onFeaturesChange: jest.fn(),
    ...overrides,
  };
}

describe('ScmFeatureSelectionPanel', () => {
  const organization = OrganizationFixture({
    features: ['performance-view', 'session-replay', 'profiling-view'],
  });

  it('shows the trial banner and per-feature volumes during onboarding', async () => {
    render(
      <ScmFeatureSelectionPanel {...defaultProps({analyticsFlow: 'onboarding'})} />,
      {
        organization,
      }
    );

    expect(
      await screen.findByText('What do you want to instrument?')
    ).toBeInTheDocument();
    expect(screen.getByText(/unlimited volume for 14 days/)).toBeInTheDocument();
    expect(screen.getByText('5,000 errors / mo')).toBeInTheDocument();
  });

  it('hides the trial banner and per-feature volumes outside onboarding', async () => {
    render(
      <ScmFeatureSelectionPanel {...defaultProps({analyticsFlow: 'project-creation'})} />,
      {organization}
    );

    // Feature cards still render under a Products header, without the
    // trial/billing framing.
    expect(await screen.findByText('Products')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeInTheDocument();

    expect(screen.queryByText(/unlimited volume for 14 days/)).not.toBeInTheDocument();
    expect(screen.queryByText('5,000 errors / mo')).not.toBeInTheDocument();
  });
});
