import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSeerCreditCheck} from 'sentry/utils/seer/useSeerCreditCheck';

describe('useSeerCreditCheck', () => {
  const organization = OrganizationFixture({features: ['seer-credit-checks']});
  const url = `/organizations/${organization.slug}/seer/credit-check/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('reports when the org cannot afford the operation', async () => {
    const request = MockApiClient.addMockResponse({
      url,
      match: [MockApiClient.matchQuery({operation: 'autofix_root_cause'})],
      body: {hasEnoughCredits: false},
    });

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('autofix_root_cause'),
      {organization}
    );

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.hasEnoughCredits).toBe(false));
    expect(result.current.isPending).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('checks each operation separately', async () => {
    MockApiClient.addMockResponse({
      url,
      match: [MockApiClient.matchQuery({operation: 'autofix_root_cause'})],
      body: {hasEnoughCredits: true},
    });
    MockApiClient.addMockResponse({
      url,
      match: [MockApiClient.matchQuery({operation: 'agent_chat_message'})],
      body: {hasEnoughCredits: false},
    });

    const {result} = renderHookWithProviders(
      () => ({
        rootCause: useSeerCreditCheck('autofix_root_cause'),
        chat: useSeerCreditCheck('agent_chat_message'),
      }),
      {organization}
    );

    await waitFor(() => expect(result.current.chat.hasEnoughCredits).toBe(false));
    expect(result.current.rootCause.hasEnoughCredits).toBe(true);
  });

  it('does not call the endpoint without seer-credit-checks', () => {
    const request = MockApiClient.addMockResponse({
      url,
      body: {hasEnoughCredits: false},
    });

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('autofix_root_cause'),
      {organization: OrganizationFixture({features: []})}
    );

    expect(result.current).toEqual(
      expect.objectContaining({hasEnoughCredits: true, isPending: false})
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('does not call the endpoint when disabled', () => {
    const request = MockApiClient.addMockResponse({
      url,
      body: {hasEnoughCredits: false},
    });

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('autofix_root_cause', {enabled: false}),
      {organization}
    );

    expect(result.current).toEqual(
      expect.objectContaining({hasEnoughCredits: true, isPending: false})
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('fails open when the check errors', async () => {
    MockApiClient.addMockResponse({url, statusCode: 500, body: {}});

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('autofix_root_cause'),
      {organization}
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasEnoughCredits).toBe(true);
    expect(result.current.isPending).toBe(false);
  });
});
