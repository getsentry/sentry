import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import {ScmPlatformFeaturesCore} from './scmPlatformFeaturesCore';

// Mock the virtualizer so the manual-picker Select renders in JSDOM (no layout
// engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measureElement: jest.fn(),
  })),
}));

// Provide a small platform list so the Select dropdown renders a manageable
// number of options in JSDOM.
jest.mock('sentry/data/platforms', () => {
  const actual = jest.requireActual('sentry/data/platforms');
  return {
    ...actual,
    platforms: actual.platforms.filter(
      (p: {id: string}) =>
        p.id === 'javascript' || p.id === 'python' || p.id === 'python-django'
    ),
  };
});

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
    onPlatformChange: jest.fn(),
    onFeaturesChange: jest.fn(),
    onClearProjectDetailsForm: jest.fn(),
    ...overrides,
  };
}

describe('ScmPlatformFeaturesCore', () => {
  const organization = OrganizationFixture({
    features: ['performance-view', 'session-replay', 'profiling-view'],
  });

  describe('trial/billing framing', () => {
    it('shows the trial banner and per-feature volumes during onboarding', async () => {
      render(
        <ScmPlatformFeaturesCore {...defaultProps({analyticsFlow: 'onboarding'})} />,
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
        <ScmPlatformFeaturesCore
          {...defaultProps({analyticsFlow: 'project-creation'})}
        />,
        {organization}
      );

      // Feature cards still render, just without the trial/billing framing.
      expect(
        await screen.findByText('What do you want to instrument?')
      ).toBeInTheDocument();
      expect(screen.getByRole('checkbox', {name: /Tracing/})).toBeInTheDocument();

      expect(screen.queryByText(/unlimited volume for 14 days/)).not.toBeInTheDocument();
      expect(screen.queryByText('5,000 errors / mo')).not.toBeInTheDocument();
    });
  });
});
