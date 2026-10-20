import {useState} from 'react';
import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {RequestOptions} from 'sentry/api';

import type {AgenticRunSession} from './types';
import {useAgenticProgressInit} from './useAgenticProgressInit';

function useLocalRun({
  enabled = true,
  initialSession,
}: {
  enabled?: boolean;
  initialSession?: AgenticRunSession;
} = {}) {
  const [session, setSession] = useState(initialSession);
  const initialization = useAgenticProgressInit({
    enabled,
    session,
    onSessionChange: setSession,
  });

  return {...initialization, session};
}

describe('useAgenticProgressInit', () => {
  const organization = OrganizationFixture();
  const endpoint = `/organizations/${organization.slug}/onboarding/agent/runs/`;
  const initialSession: AgenticRunSession = {
    clientRunId: '021902d5-2333-4823-81a9-5596b331e8af',
    onboardingCode: 'Lg1iSt2qeQ',
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.asyncDelay = undefined;
  });

  it('does not initialize or save a session while disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: AgenticProgressRunFixture(),
    });

    const {result} = renderHookWithProviders(() => useLocalRun({enabled: false}), {
      organization,
    });

    expect(request).not.toHaveBeenCalled();
    expect(result.current.session).toBeUndefined();
  });

  it('initializes once with a session owned by local state', async () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });

    const {result, rerender} = renderHookWithProviders(() => useLocalRun(), {
      organization,
    });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.session).toEqual({
      clientRunId: expect.any(String),
      onboardingCode: expect.stringMatching(/^[A-Za-z0-9]{10}$/),
    });
    expect(request.mock.calls[0]?.[1]?.data).toEqual(result.current.session);
    expect(result.current.onboardingCode).toBe(result.current.session?.onboardingCode);

    rerender();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('resumes the session supplied by its host', async () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: AgenticProgressRunFixture(initialSession),
    });

    const {result} = renderHookWithProviders(() => useLocalRun({initialSession}), {
      organization,
    });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(request.mock.calls[0]?.[1]?.data).toEqual(initialSession);
    expect(result.current.session).toEqual(initialSession);
  });

  it('replaces a conflicting code while keeping the client run ID', async () => {
    const replacementRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      match: [
        (_url, options) => options.data.onboardingCode !== initialSession.onboardingCode,
      ],
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });
    const conflictRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 409,
      match: [MockApiClient.matchData(initialSession)],
      body: {detail: 'Onboarding code is unavailable'},
    });

    const {result, rerender} = renderHookWithProviders(
      () => useLocalRun({initialSession}),
      {organization}
    );

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(conflictRequest).toHaveBeenCalledTimes(1);
    expect(replacementRequest).toHaveBeenCalledTimes(1);
    expect(result.current.session?.clientRunId).toBe(initialSession.clientRunId);
    expect(result.current.session?.onboardingCode).not.toBe(
      initialSession.onboardingCode
    );
    expect(replacementRequest.mock.calls[0]?.[1]?.data).toEqual(result.current.session);

    rerender();
    expect(replacementRequest).toHaveBeenCalledTimes(1);
  });

  it('restarts a failed initialization with a fresh session', async () => {
    const failedRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Could not initialize run'},
    });

    const {result} = renderHookWithProviders(() => useLocalRun({initialSession}), {
      organization,
    });

    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(failedRequest).toHaveBeenCalledTimes(1);

    const restartedRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });

    act(() => result.current.restartRun());

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.session?.clientRunId).not.toBe(initialSession.clientRunId);
    expect(result.current.session?.onboardingCode).not.toBe(
      initialSession.onboardingCode
    );
    expect(restartedRequest.mock.calls[0]?.[1]?.data).toEqual(result.current.session);
  });

  it('does not replace a restarted session when the previous request conflicts', async () => {
    const pendingRequest = Promise.withResolvers<void>();
    // Error responses use the client's global delay.
    MockApiClient.asyncDelay = pendingRequest.promise;
    const abandonedRetry = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      asyncDelay: 0,
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });
    const conflictRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 409,
      match: [MockApiClient.matchData(initialSession)],
      body: {detail: 'Onboarding code is unavailable'},
    });
    const restartedRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      asyncDelay: 0,
      match: [(_url, options) => options.data.clientRunId !== initialSession.clientRunId],
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });

    const {result} = renderHookWithProviders(() => useLocalRun({initialSession}), {
      organization,
    });

    await waitFor(() => expect(conflictRequest).toHaveBeenCalledTimes(1));
    MockApiClient.asyncDelay = undefined;
    act(() => result.current.restartRun());
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    const restartedSession = result.current.session;

    await act(async () => {
      pendingRequest.resolve();
      await pendingRequest.promise;
    });

    expect(result.current.session).toEqual(restartedSession);
    expect(restartedRequest).toHaveBeenCalledTimes(1);
    expect(conflictRequest).toHaveBeenCalledTimes(1);
    expect(abandonedRetry).not.toHaveBeenCalled();
  });
});
