import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

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
});
