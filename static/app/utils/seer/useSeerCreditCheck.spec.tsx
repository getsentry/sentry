import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSeerCreditCheck} from './useSeerCreditCheck';

describe('useSeerCreditCheck', () => {
  const organization = OrganizationFixture({features: ['token-billed-seer-enabled']});
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
    expect(Sentry.logger.error).not.toHaveBeenCalled();
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

  it('rechecks when the window regains focus', async () => {
    const request = MockApiClient.addMockResponse({
      url,
      body: {hasEnoughCredits: true},
    });

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('autofix_root_cause'),
      {organization}
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(request).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('does not call the endpoint without token-billed-seer-enabled', () => {
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
      expect.objectContaining({
        hasEnoughCredits: true,
        hasCheckedSinceMount: true,
        isPending: false,
      })
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([400, 429, 500])('logs HTTP %s once and fails open', async statusCode => {
    const request = MockApiClient.addMockResponse({url, statusCode, body: {}});

    const {result} = renderHookWithProviders(
      () => ({
        alert: useSeerCreditCheck('autofix_solution', {billingFeature: 4}),
        action: useSeerCreditCheck('autofix_solution', {billingFeature: 4}),
      }),
      {organization}
    );

    await waitFor(() => expect(result.current.action.isError).toBe(true));
    expect(result.current.action.hasEnoughCredits).toBe(true);
    expect(result.current.action.hasCheckedSinceMount).toBe(true);
    expect(result.current.action.isPending).toBe(false);
    expect(result.current.alert.hasEnoughCredits).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(Sentry.logger.error).toHaveBeenCalledTimes(1);
    expect(Sentry.logger.error).toHaveBeenCalledWith('Seer credit check request failed', {
      feature: 'seer_credit_check',
      operation: 'autofix_solution',
      billing_feature: 4,
      'http.response_status_code': statusCode,
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('says when the check has answered since the caller mounted', async () => {
    MockApiClient.addMockResponse({url, body: {hasEnoughCredits: true}});

    const {result} = renderHookWithProviders(
      () => useSeerCreditCheck('agent_chat_message'),
      {organization}
    );

    expect(result.current.hasCheckedSinceMount).toBe(false);
    await waitFor(() => expect(result.current.hasCheckedSinceMount).toBe(true));
  });
});
