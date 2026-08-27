import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {RequestOptions} from 'sentry/api';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';

import {useAgenticProgressInit} from './useAgenticProgressInit';

describe('useAgenticProgressInit', () => {
  const organization = OrganizationFixture();
  const endpoint = `/organizations/${organization.slug}/onboarding/agent/runs/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
    window.sessionStorage.clear();
  });

  it('does not initialize a run while disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: AgenticProgressRunFixture(),
    });

    renderHookWithProviders(() => useAgenticProgressInit({enabled: false}), {
      organization,
    });

    expect(request).not.toHaveBeenCalled();
  });

  it('initializes once and returns the onboarding code', async () => {
    const run = AgenticProgressRunFixture();
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: run,
    });

    const {result, rerender} = renderHookWithProviders(
      () => useAgenticProgressInit({enabled: true}),
      {organization}
    );

    await waitFor(() => expect(result.current.data).toEqual(run));
    expect(result.current.data?.onboardingCode).toBe('Lg1iSt2qeQ');
    expect(request).toHaveBeenCalledTimes(1);

    rerender();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('resumes with the client run ID and onboarding code stored in the session', async () => {
    const run = AgenticProgressRunFixture();
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: run,
    });
    const options = {
      organization,
      additionalWrapper: OnboardingContextProvider,
    };

    const firstRender = renderHookWithProviders(
      () => useAgenticProgressInit({enabled: true}),
      options
    );

    await waitFor(() => expect(firstRender.result.current.data).toEqual(run));
    await waitFor(() =>
      expect(
        JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')
          .agenticProgressClientRunId
      ).toBeDefined()
    );
    const storedSession = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');
    const storedClientRunId = storedSession.agenticProgressClientRunId;
    const storedOnboardingCode = storedSession.agenticProgressOnboardingCode;
    expect(storedOnboardingCode).toMatch(/^[A-Za-z0-9]{10}$/);
    firstRender.unmount();

    const secondRender = renderHookWithProviders(
      () => useAgenticProgressInit({enabled: true}),
      options
    );

    await waitFor(() => expect(secondRender.result.current.data).toEqual(run));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]?.data).toEqual({
      clientRunId: storedClientRunId,
      onboardingCode: storedOnboardingCode,
    });
  });

  it('generates a new onboarding code when it conflicts', async () => {
    const staleClientRunId = 'stale-client-run-id';
    const staleOnboardingCode = 'stale-code';
    const replacementRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      match: [(_url, options) => options.data.onboardingCode !== staleOnboardingCode],
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture({
          clientRunId: options.data.clientRunId,
          onboardingCode: options.data.onboardingCode,
        }),
    });
    const conflictRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 409,
      match: [
        MockApiClient.matchData({
          clientRunId: staleClientRunId,
          onboardingCode: staleOnboardingCode,
        }),
      ],
      body: {detail: 'Onboarding code is unavailable'},
    });
    window.sessionStorage.setItem(
      'onboarding',
      JSON.stringify({
        agenticProgressClientRunId: staleClientRunId,
        agenticProgressOnboardingCode: staleOnboardingCode,
      })
    );

    const {result} = renderHookWithProviders(
      () => useAgenticProgressInit({enabled: true}),
      {organization, additionalWrapper: OnboardingContextProvider}
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(conflictRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        data: {
          clientRunId: staleClientRunId,
          onboardingCode: staleOnboardingCode,
        },
      })
    );
    expect(replacementRequest).toHaveBeenCalledTimes(1);
    const replacementData = replacementRequest.mock.calls[0]?.[1]?.data;
    expect(replacementData.clientRunId).toBe(staleClientRunId);
    expect(replacementData.onboardingCode).toMatch(/^[A-Za-z0-9]{10}$/);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')).toEqual(
        expect.objectContaining({
          agenticProgressClientRunId: replacementData.clientRunId,
          agenticProgressOnboardingCode: replacementData.onboardingCode,
        })
      )
    );
  });
});
