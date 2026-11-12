import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {RequestOptions} from 'sentry/api';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';

import {useOnboardingAgentSetupRun} from './useOnboardingAgentSetupRun';

describe('useOnboardingAgentSetupRun', () => {
  const organization = OrganizationFixture();
  const endpoint = `/organizations/${organization.slug}/onboarding/agent/runs/`;

  beforeEach(() => {
    const run = AgenticProgressRunFixture({onboardingCode: undefined});
    MockApiClient.addMockResponse({url: `${endpoint}${run.runId}/`, body: run});
  });

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

    renderHookWithProviders(() => useOnboardingAgentSetupRun({enabled: false}), {
      organization,
    });

    expect(request).not.toHaveBeenCalled();
  });

  it('initializes once without supplying an onboarding code', async () => {
    const run = AgenticProgressRunFixture({onboardingCode: undefined});
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: run,
    });

    const {result, rerender} = renderHookWithProviders(
      () => useOnboardingAgentSetupRun({enabled: true}),
      {organization}
    );

    await waitFor(() => expect(result.current.run).toEqual(run));
    expect(result.current.onboardingCode).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[1]?.data).toEqual({
      clientRunId: expect.any(String),
    });

    rerender();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('resumes with the client run ID stored in the session', async () => {
    const run = AgenticProgressRunFixture({onboardingCode: undefined});
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
      () => useOnboardingAgentSetupRun({enabled: true}),
      options
    );

    await waitFor(() => expect(firstRender.result.current.run).toEqual(run));
    await waitFor(() =>
      expect(
        JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')
          .agenticProgressClientRunId
      ).toBeDefined()
    );
    const storedSession = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');
    const storedClientRunId = storedSession.agenticProgressClientRunId;
    expect(storedSession.agenticProgressOnboardingCode).toBeUndefined();
    firstRender.unmount();

    const secondRender = renderHookWithProviders(
      () => useOnboardingAgentSetupRun({enabled: true}),
      options
    );

    await waitFor(() => expect(secondRender.result.current.run).toEqual(run));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]?.data).toEqual({
      clientRunId: storedClientRunId,
    });
  });

  it('replaces sessions that already issued a client-generated onboarding code', async () => {
    const staleClientRunId = '021902d5-2333-4823-81a9-5596b331e8af';
    window.sessionStorage.setItem(
      'onboarding',
      JSON.stringify({
        agenticProgressClientRunId: staleClientRunId,
        agenticProgressOnboardingCode: 'stale-code',
      })
    );
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: AgenticProgressRunFixture({onboardingCode: undefined}),
    });

    const {result} = renderHookWithProviders(
      () => useOnboardingAgentSetupRun({enabled: true}),
      {organization, additionalWrapper: OnboardingContextProvider}
    );

    await waitFor(() => expect(result.current.run).toBeDefined());
    const replacementSession = request.mock.calls[0]?.[1]?.data;
    expect(replacementSession).toEqual({clientRunId: expect.any(String)});
    expect(replacementSession.clientRunId).not.toBe(staleClientRunId);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('onboarding') ?? '{}')).toEqual({
        agenticProgressClientRunId: replacementSession.clientRunId,
      })
    );
  });

  it('persists a fresh run on restart while preserving other onboarding choices', async () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: (_url: string, options: RequestOptions) =>
        AgenticProgressRunFixture(options.data),
    });
    const selectedPlatform = {key: 'javascript-react', name: 'React'};
    sessionStorage.setItem('onboarding', JSON.stringify({selectedPlatform}));

    const {result} = renderHookWithProviders(
      () => useOnboardingAgentSetupRun({enabled: true}),
      {organization, additionalWrapper: OnboardingContextProvider}
    );

    await waitFor(() => expect(result.current.run).toBeDefined());
    const originalSession = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');

    act(() => result.current.restartRun());

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    const nextSession = JSON.parse(sessionStorage.getItem('onboarding') ?? '{}');
    expect(nextSession.selectedPlatform).toEqual(selectedPlatform);
    expect(nextSession.agenticProgressClientRunId).not.toBe(
      originalSession.agenticProgressClientRunId
    );
    expect(nextSession.agenticProgressOnboardingCode).toBeUndefined();
    expect(request.mock.calls[1]?.[1]?.data).toEqual({
      clientRunId: nextSession.agenticProgressClientRunId,
    });
  });
});
