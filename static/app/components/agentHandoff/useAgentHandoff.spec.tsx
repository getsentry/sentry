import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffFlow, useAgentHandoff} from './useAgentHandoff';

describe('useAgentHandoff', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const prompt = 'Fetch the guide. Your secret token is `sntryh_example`.';
  const writeText = jest.fn();
  const options = {disableIpPinning: false};

  function renderHandoff() {
    return renderHookWithProviders(() => useAgentHandoff(AgentHandoffFlow.ONBOARDING), {
      organization,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
  });

  afterEach(() => jest.restoreAllMocks());

  it('reuses a valid prompt after a clipboard failure and refreshes it after expiration', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    const {result} = renderHandoff();
    await act(async () => {
      await expect(result.current.mutateAsync(options)).rejects.toThrow('Unable to copy');
    });
    await act(async () => {
      await result.current.mutateAsync(options);
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenLastCalledWith(prompt);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 360_000);
    await act(async () => {
      await result.current.mutateAsync(options);
    });
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('reports a safe error when minting fails', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Unavailable'},
    });
    const {result} = renderHandoff();
    await act(async () => {
      await expect(result.current.mutateAsync(options)).rejects.toThrow(
        'Unable to create your agent prompt. Please try again.'
      );
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('starts a deferred clipboard write before minting finishes', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const write = jest.fn().mockResolvedValue(undefined);
    class DeferredClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    Object.assign(globalThis, {ClipboardItem: DeferredClipboardItem});
    Object.assign(navigator, {clipboard: {write, writeText}});
    const {result} = renderHandoff();

    act(() => result.current.mutate(options));

    expect(mint).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();

    const item = write.mock.calls[0]![0][0] as DeferredClipboardItem;
    const text = item.data['text/plain']!.then(blob => blob.text());
    await act(() => {
      resolve();
      return promise;
    });
    await expect(text).resolves.toBe(prompt);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('finishes a user-initiated copy after unmounting', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {prompt, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const {result, unmount} = renderHandoff();
    act(() => result.current.mutate(options));
    await waitFor(() => expect(mint).toHaveBeenCalledTimes(1));
    unmount();
    await act(() => {
      resolve();
      return promise;
    });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
  });
});
