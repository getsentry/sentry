import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixCreditsDisabled} from './autofixCredits';

const organization = OrganizationFixture({
  features: ['seer-credit-checks', 'token-billed-seer-enabled'],
});
const creditCheckUrl = `/organizations/${organization.slug}/seer/credit-check/`;

function ContinueButton() {
  const disabled = useAutofixCreditsDisabled('solution');
  return <button disabled={disabled}>Continue</button>;
}

describe('useAutofixCreditsDisabled', () => {
  it('holds the trigger disabled until its own check answers, even with an answer cached', async () => {
    // One cache across both mounts, as the app keeps one.
    const queryClient = makeTestQueryClient();
    const tree = (
      <QueryClientProvider client={queryClient}>
        <ContinueButton />
      </QueryClientProvider>
    );

    MockApiClient.addMockResponse({
      url: creditCheckUrl,
      body: {hasEnoughCredits: true},
    });
    const {unmount} = render(tree, {organization});
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    unmount();

    // Credits run out before the next mount, whose recheck hasn't answered yet.
    let answerRecheck!: () => void;
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: creditCheckUrl,
      body: {hasEnoughCredits: false},
      asyncDelay: new Promise<void>(resolve => {
        answerRecheck = resolve;
      }),
    });
    render(tree, {organization});

    // The cached answer says yes, but it's from before credits ran out.
    expect(screen.getByRole('button')).toBeDisabled();

    answerRecheck();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
