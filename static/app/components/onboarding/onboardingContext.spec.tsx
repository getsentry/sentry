import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';

const platform = {
  key: 'javascript-nextjs' as const,
  name: 'Next.js',
  language: 'javascript',
  type: 'framework' as const,
  link: null,
  category: 'browser' as const,
};

function StateConsumer() {
  const {
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
      <button onClick={() => setSelectedPlatform(undefined)}>Clear platform</button>
      <button onClick={() => resetOnboarding()}>Reset onboarding</button>
    </div>
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
  });

  it('keeps a resolved repository and its derived state on load', () => {
    render(
      <OnboardingContextProvider
        initialValue={{
          selectedRepository: RepositoryFixture({id: '42'}),
          selectedPlatform: platform,
          selectedFeatures: [ProductSolution.ERROR_MONITORING],
        }}
      >
        <StateConsumer />
      </OnboardingContextProvider>
    );

    expect(screen.getByText('repo:42')).toBeInTheDocument();
    expect(screen.getByText('platform:javascript-nextjs')).toBeInTheDocument();
    expect(screen.getByText('features:1')).toBeInTheDocument();
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
        }}
      >
        <StateConsumer />
      </OnboardingContextProvider>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Clear platform'}));

    // Clearing one field must stay local to that field. This previously routed
    // through removeOnboarding and wiped the whole session, taking the
    // connected repository with it.
    expect(screen.getByText('no-platform')).toBeInTheDocument();
    expect(screen.getByText('repo:42')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')).toMatchObject({
      selectedRepository: {id: '42'},
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
});
