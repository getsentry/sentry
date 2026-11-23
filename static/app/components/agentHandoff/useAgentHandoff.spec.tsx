import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentHandoffFlow} from './types';
import {useAgentHandoff} from './useAgentHandoff';

const addFeaturePrompt =
  'Read and follow https://sentry-jest-tests.example.com/agent-handoff.md verbatim to set up tracing. Your handoff code is `sntryh_example`.';

describe('useAgentHandoff', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const code = 'sntryh_example';
  const handoffId = 'a'.repeat(32);
  const prompt =
    'Read and follow https://sentry-jest-tests.example.com/agent-handoff.md verbatim. Your handoff code is `sntryh_example`.';
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
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
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
      await expect(result.current.copyPrompt(options)).resolves.toBe(handoffId);
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {context, disableIpPinning: false, flow: 'onboarding'},
      })
    );
    const item = write.mock.calls.at(-1)![0][0] as {data: Record<string, Promise<Blob>>};
    await expect(item.data['text/plain']!.then(blob => blob.text())).resolves.toBe(
      prompt
    );

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 241_000);
    await act(async () => {
      await result.current.copyPrompt(options);
    });
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('reuses a copied code until the page is hidden', async () => {
    let mintCount = 0;
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: () => {
        mintCount++;
        return {
          code: `sntryh_code${mintCount}`,
          handoffId: String(mintCount).repeat(32),
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        };
      },
    });
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );

    await act(async () => {
      await expect(result.current.copyPrompt(options)).resolves.toBe('1'.repeat(32));
    });
    await act(async () => {
      await expect(result.current.copyPrompt(options)).resolves.toBe('1'.repeat(32));
    });
    expect(mint).toHaveBeenCalledTimes(1);

    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      await expect(result.current.copyPrompt(options)).resolves.toBe('2'.repeat(32));
    });
    expect(mint).toHaveBeenCalledTimes(2);
    const copied = await Promise.all(
      write.mock.calls.map(([[item]]) =>
        (item as {data: Record<string, Promise<Blob>>}).data['text/plain']!.then(blob =>
          blob.text()
        )
      )
    );
    expect(copied[1]).toContain('`sntryh_code1`');
    expect(copied[2]).toContain('`sntryh_code2`');
  });

  it('keeps a code that never reached the clipboard when the page is hidden', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    write.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );

    await act(async () => {
      await expect(result.current.copyPrompt(options)).rejects.toThrow('Unable to copy');
    });
    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    hidden.mockReturnValue(false);

    await act(async () => {
      await expect(result.current.copyPrompt(options)).resolves.toBe(handoffId);
    });
    expect(mint).toHaveBeenCalledTimes(1);
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
    const item = write.mock.calls[0]![0][0] as {data: Record<string, Promise<Blob>>};
    await expect(item.data['text/plain']).rejects.toThrow(
      'Unable to create your agent prompt. Try again.'
    );
  });

  it('starts a deferred clipboard write before minting finishes', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
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

    let copy!: Promise<string>;
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
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const {result} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );

    let firstCopy!: Promise<string>;
    let secondCopy!: Promise<string>;
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

  it('add_feature flow names the product and mints a new code when projectId changes', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const contextA = {product: 'tracing' as const, projectId: 'proj-aaa'};
    const contextB = {product: 'tracing' as const, projectId: 'proj-bbb'};

    const {result, rerender} = renderHookWithProviders(
      ({ctx}: {ctx: typeof contextA}) =>
        useAgentHandoff(AgentHandoffFlow.ADD_FEATURE, ctx),
      {organization, initialProps: {ctx: contextA}}
    );

    await act(async () => {
      await result.current.copyPrompt(options);
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {context: contextA, disableIpPinning: false, flow: 'add_feature'},
      })
    );
    const itemA = write.mock.calls[0]![0][0] as {data: Record<string, Promise<Blob>>};
    await expect(itemA.data['text/plain']!.then(b => b.text())).resolves.toBe(
      addFeaturePrompt
    );

    rerender({ctx: contextB});
    await act(async () => {
      await result.current.copyPrompt(options);
    });
    expect(mint).toHaveBeenCalledTimes(2);
    expect(mint).toHaveBeenLastCalledWith(
      url,
      expect.objectContaining({
        data: {context: contextB, disableIpPinning: false, flow: 'add_feature'},
      })
    );
  });

  it('finishes a user-initiated copy after unmounting', async () => {
    const {promise, resolve} = Promise.withResolvers<void>();
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
      asyncDelay: promise,
    });
    const {result, unmount} = renderHookWithProviders(
      () => useAgentHandoff(AgentHandoffFlow.ONBOARDING, context),
      {organization}
    );
    let copy!: Promise<string>;
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
