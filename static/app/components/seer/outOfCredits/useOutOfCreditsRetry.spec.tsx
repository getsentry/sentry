import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useOutOfCreditsRetry} from './useOutOfCreditsRetry';

describe('useOutOfCreditsRetry', () => {
  const organization = OrganizationFixture({
    features: ['token-billed-seer-enabled'],
  });

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
});
