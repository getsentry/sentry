import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffFlow, useAgentHandoff} from './useAgentHandoff';

describe('useAgentHandoff', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const code = 'sntryh_example';
  const prompt =
    'Follow the instructions verbatim at https://sentry-jest-tests.example.com/agent-handoff/. Your handoff code is `sntryh_example`.';
  const write = jest.fn();
  const options = {disableIpPinning: false};
  const context = {runId: 'a'.repeat(32)};

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    class TestClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    Object.assign(globalThis, {ClipboardItem: TestClipboardItem});
    write.mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {write}});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
  });

  it('reuses a valid prompt after a clipboard failure and refreshes it near expiration', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    write.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );
    await act(async () => {
      await expect(result.current.copyPrompt(options)).rejects.toThrow('Unable to copy');
    });
    await act(async () => {
      await result.current.copyPrompt(options);
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          context,
          disableIpPinning: false,
          flow: 'onboarding',
        },
      })
    );
    const item = write.mock.calls.at(-1)![0][0] as {
      data: Record<string, Promise<Blob>>;
    };
    await expect(item.data['text/plain']!.then(blob => blob.text())).resolves.toBe(
      prompt
    );

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 241_000);
    await act(async () => {
      await result.current.copyPrompt(options);
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
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );
    await act(async () => {
      await expect(result.current.copyPrompt(options)).rejects.toThrow(
        'Unable to create your agent prompt. Try again.'
      );
    });
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0]![0][0] as {
      data: Record<string, Promise<Blob>>;
    };
    await expect(item.data['text/plain']).rejects.toThrow(
      'Unable to create your agent prompt. Try again.'
    );
  });

  it('starts a deferred clipboard write before minting finishes', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    class DeferredClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    Object.assign(globalThis, {ClipboardItem: DeferredClipboardItem});
    Object.assign(navigator, {clipboard: {write}});
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );

    let copy!: Promise<void>;
    act(() => {
      copy = result.current.copyPrompt(options);
    });

    expect(mint).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0]![0][0] as DeferredClipboardItem;
    const text = item.data['text/plain']!.then(blob => blob.text());
    await act(async () => {
      resolve();
      await copy;
    });
    await expect(text).resolves.toBe(prompt);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('reuses an in-flight copy operation', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );

    let firstCopy!: Promise<void>;
    let secondCopy!: Promise<void>;
    act(() => {
      firstCopy = result.current.copyPrompt(options);
      secondCopy = result.current.copyPrompt(options);
    });

    expect(secondCopy).toBe(firstCopy);
    expect(mint).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
      await Promise.all([firstCopy, secondCopy]);
    });
  });

  it('finishes a user-initiated copy after unmounting', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const {result, unmount} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );
    let copy!: Promise<void>;
    act(() => {
      copy = result.current.copyPrompt(options);
    });
    await waitFor(() => expect(mint).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolve();
      await copy;
    });
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  });
});
