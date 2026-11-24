import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useOutOfCreditsRetry} from './useOutOfCreditsRetry';

describe('useOutOfCreditsRetry', () => {
  const organization = OrganizationFixture({features: ['token-billed-seer-enabled']});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not check when the retry is not on screen', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/credit-check/`,
      match: [MockApiClient.matchQuery({operation: 'autofix_code_changes'})],
      body: {hasEnoughCredits: false},
    });

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('code_changes', {enabled: false}),
      {organization}
    );

    expect(result.current).toEqual({disabled: false, tooltip: undefined});
    expect(request).not.toHaveBeenCalled();
  });

  it('says when the daily usage limit holds the retry back', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/credit-check/`,
      match: [MockApiClient.matchQuery({operation: 'autofix_code_changes'})],
      body: {hasEnoughCredits: false, denialReason: 'daily_cap_exceeded'},
    });

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('code_changes', {enabled: true}),
      {organization}
    );

    await waitFor(() =>
      expect(result.current.tooltip).toBe('Your organization hit its daily usage limit.')
    );
    expect(result.current.disabled).toBe(true);
  });
});
