import {useState} from 'react';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';

const platform = {
  key: 'javascript-nextjs' as const,
  name: 'Next.js',
  language: 'javascript',
  type: 'framework' as const,
  link: null,
  category: 'browser' as const,
};

const selectedMessagingSetup = {
  mode: 'selected',
  providerKey: 'slack',
  integrationId: '15',
  channelId: 'C123',
} as const satisfies ScmMessagingSetup;

function StateConsumer() {
  const {
    messagingSetup,
    selectedRepository,
    selectedPlatform,
    selectedFeatures,
    setSelectedPlatform,
    resetOnboarding,
  } = useOnboardingContext();
  return (
    <div>
      <div>{selectedRepository ? `repo:${selectedRepository.id}` : 'no-repo'}</div>
      <div>{selectedPlatform ? `platform:${selectedPlatform.key}` : 'no-platform'}</div>
      <div>
        {selectedFeatures ? `features:${selectedFeatures.length}` : 'no-features'}
      </div>
      <div>{`messaging:${messagingSetup.mode}`}</div>
      <button onClick={() => setSelectedPlatform(undefined)}>Clear platform</button>
      <button onClick={() => resetOnboarding()}>Reset onboarding</button>
    </div>
  );
}

function ExitConsumer({onExit}: {onExit: () => void}) {
  const {discardOnboardingSession} = useOnboardingContext();
  return (
    <button
      onClick={() => {
        discardOnboardingSession();
        onExit();
      }}
    >
      Leave flow
    </button>
  );
}

/**
 * Mirrors leaving the onboarding flow: one click both clears the session and
 * unmounts the provider, giving React no render in which to process a pending
 * state update.
 */
function ExitFlowHarness() {
  const [inFlow, setInFlow] = useState(true);

  if (!inFlow) {
    return <div>left the flow</div>;
  }

  return (
    <OnboardingContextProvider>
      <ExitConsumer onExit={() => setInFlow(false)} />
    </OnboardingContextProvider>
  );
}

describe('OnboardingContextProvider', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('drops a stale optimistic repository and its derived state on load', async () => {
    // An optimistic repo (empty id) persisted mid-resolution can never fetch
    // detection. Dropping it must also clear the repo-derived platform and
    // features so the platform step doesn't show a platform with no repo.
    render(
      <OnboardingContextProvider
        initialValue={{
          selectedRepository: RepositoryFixture({id: ''}),
          selectedPlatform: platform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
        }}
      >
        <StateConsumer />
      </OnboardingContextProvider>
    );

    expect(await screen.findByText('no-repo')).toBeInTheDocument();
    expect(screen.getByText('no-platform')).toBeInTheDocument();
    expect(screen.getByText('no-features')).toBeInTheDocument();
    expect(screen.getByText('messaging:unconfigured')).toBeInTheDocument();
  });

  it('keeps a resolved repository and its derived state on load', () => {
    render(
      <OnboardingContextProvider
        initialValue={{
          selectedRepository: RepositoryFixture({id: '42'}),
          selectedPlatform: platform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
          messagingSetup: selectedMessagingSetup,
        }}
      >
        <StateConsumer />
      </OnboardingContextProvider>
    );

    expect(screen.getByText('repo:42')).toBeInTheDocument();
    expect(screen.getByText('platform:javascript-nextjs')).toBeInTheDocument();
    expect(screen.getByText('features:1')).toBeInTheDocument();
    expect(screen.getByText('messaging:selected')).toBeInTheDocument();
  });

  it('restores messaging setup from session storage after a remount', () => {
    sessionStorage.setItem(
      'onboarding',
      JSON.stringify({
        messagingSetup: {
          mode: 'selected',
          providerKey: 'discord',
          integrationId: '20',
          channelId: '123456789',
        },
      })
    );

    const firstRender = render(
      <OnboardingContextProvider>
        <StateConsumer />
      </OnboardingContextProvider>
    );
    expect(screen.getByText('messaging:selected')).toBeInTheDocument();

    firstRender.unmount();
    render(
      <OnboardingContextProvider>
        <StateConsumer />
      </OnboardingContextProvider>
    );

    expect(screen.getByText('messaging:selected')).toBeInTheDocument();
  });
});

describe('OnboardingContextProvider session semantics', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('keeps the rest of the session when clearing the selected platform', async () => {
    render(
      <OnboardingContextProvider
        initialValue={{
          selectedRepository: RepositoryFixture({id: '42'}),
          selectedPlatform: platform,
          messagingSetup: selectedMessagingSetup,
        }}
      >
        <StateConsumer />
      </OnboardingContextProvider>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Clear platform'}));

    // Clearing one field must stay local to that field. This previously routed
    // through removeOnboarding and wiped the whole session, taking the connected
    // repository with it. Messaging destinations are organization-scoped, so they
    // must survive a platform change too.
    expect(screen.getByText('no-platform')).toBeInTheDocument();
    expect(screen.getByText('repo:42')).toBeInTheDocument();
    expect(screen.getByText('messaging:selected')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')).toMatchObject({
      selectedRepository: {id: '42'},
      messagingSetup: selectedMessagingSetup,
    });
  });

  it('clears persisted session state on resetOnboarding', async () => {
    // Seeded through sessionStorage rather than the initialValue prop:
    // useSessionStorage's removeItem resets in-memory state back to
    // initialValue, so a seeded prop would be restored rather than cleared.
    // The real provider passes no initialValue, so removal is total there.
    sessionStorage.setItem(
      'onboarding',
      JSON.stringify({
        selectedRepository: RepositoryFixture({id: '42'}),
        selectedPlatform: platform,
      })
    );

    render(
      <OnboardingContextProvider>
        <StateConsumer />
      </OnboardingContextProvider>
    );
    expect(screen.getByText('platform:javascript-nextjs')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Reset onboarding'}));

    expect(screen.getByText('no-platform')).toBeInTheDocument();
    expect(screen.getByText('no-repo')).toBeInTheDocument();
    expect(sessionStorage.getItem('onboarding')).toBeNull();
  });

  it('clears persisted session state when the provider unmounts in the same commit', async () => {
    // Leaving the flow clears the session and navigates away in one click, so
    // the provider unmounts in that same commit. resetOnboarding cannot be used
    // for this: useSessionStorage's removeItem performs the storage removal
    // inside a setState updater, and React drops the update — and the removal
    // with it — when the owning subtree unmounts before the queue is processed.
    // Verified in a browser: skipping from scm-platform-features and
    // scm-messaging left the session behind, so the next /onboarding visit
    // silently resumed from it.
    sessionStorage.setItem(
      'onboarding',
      JSON.stringify({
        selectedRepository: RepositoryFixture({id: '42'}),
        selectedPlatform: platform,
      })
    );

    render(<ExitFlowHarness />);

    await userEvent.click(screen.getByRole('button', {name: 'Leave flow'}));

    expect(screen.getByText('left the flow')).toBeInTheDocument();
    expect(sessionStorage.getItem('onboarding')).toBeNull();
  });
});
