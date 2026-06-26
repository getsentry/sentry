import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';

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
    onPlatformChange: jest.fn(),
    onFeaturesChange: jest.fn(),
    onClearProjectDetailsForm: jest.fn(),
    ...overrides,
  };
}

describe('ScmPlatformFeaturesCore', () => {
  const organization = OrganizationFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the manual platform picker when no repository is connected', () => {
    render(<ScmPlatformFeaturesCore {...defaultProps()} />, {organization});

    expect(screen.getByText('Select a platform')).toBeInTheDocument();
  });

  it('fires step_viewed analytics in onboarding on mount', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    render(<ScmPlatformFeaturesCore {...defaultProps({analyticsFlow: 'onboarding'})} />, {
      organization,
    });

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.scm_platform_features_step_viewed',
      expect.anything()
    );
  });

  it('does not fire step_viewed in project creation (page-viewed fires once upstream)', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    render(
      <ScmPlatformFeaturesCore {...defaultProps({analyticsFlow: 'project-creation'})} />,
      {
        organization,
      }
    );

    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'onboarding.scm_platform_features_step_viewed',
      expect.anything()
    );
  });

  it('clears the selected platform from the manual picker', async () => {
    const onPlatformChange = jest.fn();
    const onFeaturesChange = jest.fn();
    const onClearProjectDetailsForm = jest.fn();
    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          onPlatformChange,
          onFeaturesChange,
          onClearProjectDetailsForm,
        })}
      />,
      {organization}
    );

    await userEvent.click(await screen.findByTestId('icon-close'));

    expect(onPlatformChange).toHaveBeenCalledWith(undefined);
    expect(onFeaturesChange).toHaveBeenCalledWith(undefined);
    expect(onClearProjectDetailsForm).toHaveBeenCalled();
  });

  it('does not offer a clear button when a platform was auto-detected', async () => {
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {platforms: [DetectedPlatformFixture({platform: 'python'})]},
    });

    render(
      <ScmPlatformFeaturesCore {...defaultProps({selectedRepository: repository})} />,
      {organization}
    );

    // Detection resolves to the auto-detected view; switch into the manual picker.
    await userEvent.click(
      await screen.findByRole('button', {name: "Doesn't look right? Change platform"})
    );

    // The manual picker is showing (with a route back to the recommendation),
    // but the clear control is suppressed: clearing would desync the picker from
    // the detected fallback.
    expect(
      screen.getByRole('button', {name: 'Back to recommended platforms'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('icon-close')).not.toBeInTheDocument();
  });
});
