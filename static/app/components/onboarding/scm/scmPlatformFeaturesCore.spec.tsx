import {useState} from 'react';
import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';

import {ScmPlatformFeaturesCore} from './scmPlatformFeaturesCore';

interface MockDebouncedCallback {
  callback: () => void;
  isActive: () => boolean;
}

const mockDebouncedCallbacks: MockDebouncedCallback[] = [];

jest.mock('lodash/debounce', () => (callback: () => void) => {
  const debounced = jest.fn();
  mockDebouncedCallbacks.push({
    callback,
    isActive: () => debounced.mock.calls.length > 0,
  });
  return debounced;
});

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

const javascriptPlatform: OnboardingSelectedSDK = {
  key: 'javascript',
  name: 'Browser JavaScript',
  language: 'javascript',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/javascript/',
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

  beforeEach(() => {
    mockDebouncedCallbacks.length = 0;
  });

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

  it('fires only growth.select_platform for the project-creation SCM flow', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {platforms: [DetectedPlatformFixture({platform: 'python'})]},
    });

    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedRepository: repository,
          selectedPlatform: undefined,
        })}
      />,
      {organization}
    );

    await waitFor(() =>
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'growth.select_platform',
        expect.objectContaining({
          platform_id: 'python',
          selection_source: 'detected',
          source: 'project-creation',
          variant: 'scm',
        })
      )
    );
    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'project_creation.platform_selected',
      expect.anything()
    );
  });

  it('keeps the onboarding SCM platform-selection event', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {platforms: [DetectedPlatformFixture({platform: 'python'})]},
    });

    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          analyticsFlow: 'onboarding',
          selectedRepository: repository,
          selectedPlatform: undefined,
        })}
      />,
      {organization}
    );

    await waitFor(() =>
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'onboarding.scm_platform_selected',
        expect.objectContaining({platform: 'python', source: 'detected'})
      )
    );
    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'growth.select_platform',
      expect.anything()
    );
  });

  it('tracks one debounced manual platform search with its result count', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          analyticsFlow: 'project-creation',
          selectedPlatform: undefined,
        })}
      />,
      {organization}
    );

    await userEvent.type(screen.getByRole('textbox'), 'java ');

    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'growth.platformpicker_search',
      expect.anything()
    );

    const activeDebouncedCallbacks = mockDebouncedCallbacks.filter(({isActive}) =>
      isActive()
    );
    expect(activeDebouncedCallbacks).toHaveLength(1);

    act(() => {
      activeDebouncedCallbacks[0]!.callback();
    });

    expect(trackAnalyticsSpy).toHaveBeenCalledTimes(1);

    expect(trackAnalyticsSpy).toHaveBeenCalledWith('growth.platformpicker_search', {
      organization,
      search: 'java ',
      num_results: 1,
      source: 'project-creation',
      variant: 'scm',
    });
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

  it('keeps a non-default detected selection when returning to the recommended view', async () => {
    const onFeaturesChange = jest.fn();
    const onClearProjectDetailsForm = jest.fn();
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    // python is the recommendation (first detected); javascript is the second.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {
        platforms: [
          DetectedPlatformFixture({platform: 'python'}),
          DetectedPlatformFixture({platform: 'javascript'}),
        ],
      },
    });

    // Controlled, so hold the selection in state for the manual-pick flow.
    function Host() {
      const [platform, setPlatform] = useState<OnboardingSelectedSDK | undefined>(
        pythonPlatform
      );
      return (
        <ScmPlatformFeaturesCore
          analyticsFlow="onboarding"
          selectedRepository={repository}
          selectedPlatform={platform}
          onPlatformChange={setPlatform}
          onFeaturesChange={onFeaturesChange}
          onClearProjectDetailsForm={onClearProjectDetailsForm}
        />
      );
    }

    render(<Host />, {organization});

    // Select the second detected platform, then open the manual picker.
    await userEvent.click(
      await screen.findByRole('radio', {name: 'Browser JavaScript Language'})
    );
    await userEvent.click(
      screen.getByRole('button', {name: "Doesn't look right? Change platform"})
    );
    onFeaturesChange.mockClear();
    onClearProjectDetailsForm.mockClear();

    // Returning keeps the chosen detected platform: it is already detected, so
    // nothing is reset and the card stays selected.
    await userEvent.click(
      screen.getByRole('button', {name: 'Back to recommended platforms'})
    );

    expect(
      await screen.findByRole('radio', {name: 'Browser JavaScript Language'})
    ).toBeChecked();
    expect(onFeaturesChange).not.toHaveBeenCalled();
    expect(onClearProjectDetailsForm).not.toHaveBeenCalled();
  });

  it('does not reset state when returning without a change', async () => {
    const onFeaturesChange = jest.fn();
    const onClearProjectDetailsForm = jest.fn();
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    // python is both the recommendation and the already-selected platform.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {platforms: [DetectedPlatformFixture({platform: 'python'})]},
    });

    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          selectedRepository: repository,
          selectedPlatform: pythonPlatform,
          onFeaturesChange,
          onClearProjectDetailsForm,
        })}
      />,
      {organization}
    );

    // Open the manual picker from the detected view, then return without
    // choosing a different platform.
    await userEvent.click(
      await screen.findByRole('button', {name: "Doesn't look right? Change platform"})
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Back to recommended platforms'})
    );

    expect(onFeaturesChange).not.toHaveBeenCalled();
    expect(onClearProjectDetailsForm).not.toHaveBeenCalled();
  });

  it('reverts a manual pick to the detected platform on return, recording it', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const onPlatformChange = jest.fn();
    const onFeaturesChange = jest.fn();
    const onClearProjectDetailsForm = jest.fn();
    const repository = RepositoryFixture({
      id: '123',
      provider: {id: 'integrations:github', name: 'GitHub'},
    });
    const detectionRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/${repository.id}/platforms/`,
      body: {platforms: [DetectedPlatformFixture({platform: 'python'})]},
    });

    // The active platform is a manual pick that is not among the detected
    // platforms, so the manual picker shows with a route back to recommended.
    render(
      <ScmPlatformFeaturesCore
        {...defaultProps({
          selectedRepository: repository,
          selectedPlatform: javascriptPlatform,
          onPlatformChange,
          onFeaturesChange,
          onClearProjectDetailsForm,
        })}
      />,
      {organization}
    );

    // Wait for detection so the detected fallback (python) is available.
    await waitFor(() => expect(detectionRequest).toHaveBeenCalled());

    await userEvent.click(
      screen.getByRole('button', {name: 'Back to recommended platforms'})
    );

    // Leaving the manual pick reverts to the detected platform and records the
    // selection with the detected source.
    await waitFor(() =>
      expect(onPlatformChange).toHaveBeenCalledWith(
        expect.objectContaining({key: 'python'})
      )
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.scm_platform_selected',
      expect.objectContaining({platform: 'python', source: 'detected'})
    );
  });
});
