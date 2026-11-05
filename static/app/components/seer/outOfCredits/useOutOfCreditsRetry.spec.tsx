import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useOutOfCreditsRetry} from './useOutOfCreditsRetry';

describe('useOutOfCreditsRetry', () => {
  const organization = OrganizationFixture({features: ['seer-credit-checks']});

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
      () => useOutOfCreditsRetry('autofix_code_changes', {enabled: true}),
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
      () => useOutOfCreditsRetry('autofix_code_changes', {enabled: true}),
      {organization}
    );

    await waitFor(() =>
      expect(result.current).toEqual({disabled: false, tooltip: undefined})
    );
  });

  it('does not check when the retry is not on screen', () => {
    const request = mockCreditCheck(false);

    const {result} = renderHookWithProviders(
      () => useOutOfCreditsRetry('autofix_code_changes', {enabled: false}),
      {organization}
    );

    expect(result.current).toEqual({disabled: false, tooltip: undefined});
    expect(request).not.toHaveBeenCalled();
  });
});
