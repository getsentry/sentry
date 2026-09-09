import {GEN_AI_CONVERSATION_ID} from '@sentry/conventions/attributes';
import * as Sentry from '@sentry/react';

import {render} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

import type {SeerEmbedScope} from './renderTracking';

const timestamp = (value: string) =>
  `{% timestamp %}${JSON.stringify({value, format: 'absolute'})}{% /timestamp %}`;

/**
 * Renders already reported are suppressed for the life of the page, so every
 * test needs a scope no earlier test has used.
 */
let nextConversation = 0;
function scope(overrides: Partial<SeerEmbedScope> = {}): SeerEmbedScope {
  nextConversation += 1;
  return {
    conversationId: `run-${nextConversation}`,
    messageId: 'block-1',
    surface: 'seer_explorer',
    ...overrides,
  };
}

describe('seer embed render tracking', () => {
  let info!: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(Sentry.logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    info.mockRestore();
  });

  const attributesOf = (call: unknown[]) => call[1] as Record<string, unknown>;

  it('records a render with its conversation, message and index', () => {
    const current = scope();
    render(
      <SeerMarkdown raw={`at ${timestamp('2025-07-15T14:30:00Z')}`} scope={current} />
    );

    expect(info).toHaveBeenCalledTimes(1);
    expect(attributesOf(info.mock.calls[0]!)).toEqual(
      expect.objectContaining({
        'seer_embed.name': 'timestamp',
        'seer_embed.level': 'inline',
        'seer_embed.index': 0,
        'seer_embed.surface': 'seer_explorer',
        [GEN_AI_CONVERSATION_ID]: current.conversationId,
        'seer_embed.message_id': 'block-1',
        'seer_embed.message_key': `${current.conversationId}:block-1`,
        'seer_embed.embed_key': `${current.conversationId}:block-1:0`,
      })
    );
  });

  it('records each embed in a message separately', () => {
    render(
      <SeerMarkdown
        raw={`${timestamp('2025-07-15T14:30:00Z')} and ${timestamp('2025-07-16T14:30:00Z')}`}
        scope={scope()}
      />
    );

    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls.map(call => attributesOf(call)['seer_embed.index'])).toEqual([
      0, 1,
    ]);
  });

  it('records identical embeds in one message separately', () => {
    const same = timestamp('2025-07-15T14:30:00Z');
    render(<SeerMarkdown raw={`${same} and ${same}`} scope={scope()} />);

    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls.map(call => attributesOf(call)['seer_embed.index'])).toEqual([
      0, 1,
    ]);
  });

  it('records an embed once across re-renders of the same message', () => {
    const current = scope();
    const raw = `at ${timestamp('2025-07-15T14:30:00Z')}`;
    const {rerender} = render(<SeerMarkdown raw={raw} scope={current} />);
    expect(info).toHaveBeenCalledTimes(1);

    // Streaming remounts the paragraph holding an inline embed on every chunk.
    rerender(<SeerMarkdown raw={`${raw} and more`} scope={current} />);
    rerender(<SeerMarkdown raw={`${raw} and more text`} scope={current} />);

    expect(info).toHaveBeenCalledTimes(1);
  });

  it('records the same embed in a different message', () => {
    const raw = `at ${timestamp('2025-07-15T14:30:00Z')}`;
    const conversationId = scope().conversationId;

    render(
      <SeerMarkdown
        raw={raw}
        scope={{...scope({conversationId}), messageId: 'block-1'}}
      />
    );
    render(
      <SeerMarkdown
        raw={raw}
        scope={{...scope({conversationId}), messageId: 'block-2'}}
      />
    );

    expect(info).toHaveBeenCalledTimes(2);
    expect(
      info.mock.calls.map(call => attributesOf(call)['seer_embed.message_id'])
    ).toEqual(['block-1', 'block-2']);
  });

  it('records nothing without a scope', () => {
    render(<SeerMarkdown raw={`at ${timestamp('2025-07-15T14:30:00Z')}`} />);
    expect(info).not.toHaveBeenCalled();
  });

  it('records nothing for an embed whose props are invalid', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const captureException = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => '');

    render(
      <SeerMarkdown
        raw='{% timestamp %}{"format":"absolute"}{% /timestamp %}'
        scope={scope()}
      />
    );

    expect(info).not.toHaveBeenCalled();

    warn.mockRestore();
    captureException.mockRestore();
  });
});
