import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  render,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useOutOfCreditsRetry} from './useOutOfCreditsRetry';

describe('useOutOfCreditsRetry', () => {
  const organization = OrganizationFixture({
    features: ['seer-credit-checks', 'token-billed-seer-enabled'],
  });

  function mockCreditCheck(hasEnoughCredits: boolean) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/credit-check/`,
      match: [MockApiClient.matchQuery({operation: 'autofix_code_changes'})],
      body: {hasEnoughCredits},
    });
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('holds the retry back while the check is in flight, then disables it with a reason', async () => {
    mockCreditCheck(false);

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('code_changes', {enabled: true}),
      {organization}
    );

    expect(result.current).toEqual({disabled: true, tooltip: undefined});
    await waitFor(() =>
      expect(result.current.tooltip).toBe(
        'Your organization does not have enough Seer credits for this.'
      )
    );
    expect(result.current.disabled).toBe(true);
  });

  it('enables the retry once the organization can afford it', async () => {
    mockCreditCheck(true);

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('code_changes', {enabled: true}),
      {organization}
    );

    await waitFor(() =>
      expect(result.current).toEqual({disabled: false, tooltip: undefined})
    );
  });

  it('holds the retry back until its own check answers, even with an answer cached', async () => {
    function RetryButton() {
      const {disabled} = useOutOfCreditsRetry('code_changes', {enabled: true});
      return <button disabled={disabled}>Re-run</button>;
    }
    // One cache across both mounts, as the app keeps one.
    const queryClient = makeTestQueryClient();
    const tree = (
      <QueryClientProvider client={queryClient}>
        <RetryButton />
      </QueryClientProvider>
    );

    mockCreditCheck(true);
    const {unmount} = render(tree, {organization});
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    unmount();

    // Credits run out before the retry is back on screen, and the recheck
    // hasn't answered yet. The cached answer from before must not enable it.
    let answerRecheck!: () => void;
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/credit-check/`,
      match: [MockApiClient.matchQuery({operation: 'autofix_code_changes'})],
      body: {hasEnoughCredits: false},
      asyncDelay: new Promise<void>(resolve => {
        answerRecheck = resolve;
      }),
    });
    render(tree, {organization});

    expect(screen.getByRole('button')).toBeDisabled();

    answerRecheck();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not check when the retry is not on screen', () => {
    const request = mockCreditCheck(false);

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('code_changes', {enabled: false}),
      {organization}
    );

    expect(result.current).toEqual({disabled: false, tooltip: undefined});
    expect(request).not.toHaveBeenCalled();
  });
});
