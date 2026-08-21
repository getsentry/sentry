import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

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

// In neither platformProductAvailability nor PLATFORM_PRODUCT_INFO, so the
// section has nothing to configure.
const platformWithoutProducts: OnboardingSelectedSDK = {
  key: 'other',
  name: 'Other',
  language: 'other',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/',
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

  it('reveals the cards once a platform with products is chosen', async () => {
    const {rerender} = render(
      <ScmFeatureSelectionPanel
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedPlatform: undefined,
        })}
      />,
      {organization}
    );

    expect(await screen.findByText('Products')).toBeInTheDocument();
    expect(
      screen.getByText('Select a platform to configure products')
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', {name: /Tracing/})).not.toBeInTheDocument();

    rerender(
      <ScmFeatureSelectionPanel
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedPlatform: pythonPlatform,
        })}
      />
    );

    expect(await screen.findByRole('checkbox', {name: /Tracing/})).toBeInTheDocument();
    expect(
      screen.queryByText('Select a platform to configure products')
    ).not.toBeInTheDocument();
  });

  it('drops the section and its trailing divider for a platform with no products', async () => {
    const {rerender} = render(
      <ScmFeatureSelectionPanel
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedPlatform: pythonPlatform,
          trailing: <div>Trailing divider</div>,
        })}
      />,
      {organization}
    );

    expect(await screen.findByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Trailing divider')).toBeInTheDocument();

    rerender(
      <ScmFeatureSelectionPanel
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedPlatform: platformWithoutProducts,
          trailing: <div>Trailing divider</div>,
        })}
      />
    );

    await waitForElementToBeRemoved(() => screen.queryByText('Products'));
    expect(screen.queryByText('Trailing divider')).not.toBeInTheDocument();
  });
});
