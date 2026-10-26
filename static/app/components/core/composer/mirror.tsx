import {useCallback, useLayoutEffect} from 'react';

import type {Mention, TextRange} from './model';
import {ComposerMirror, MentionChip, MentionContent} from './styles';
import type {ComposerSource} from './types';

/** Properties that decide where each glyph lands inside the textarea. */
const MIRRORED_PROPERTIES = [
  'box-sizing',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-family',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'font-feature-settings',
  'font-kerning',
  'letter-spacing',
  'line-height',
  'tab-size',
  'text-indent',
  'text-rendering',
  'text-transform',
  'word-spacing',
  'direction',
] as const;

function toPixels(value: string) {
  return Number.parseFloat(value) || 0;
}

/**
 * Grows the textarea to fit its text, then lays the mirror exactly over the
 * textarea's text area, excluding any scrollbar, and matches its scroll.
 */
export function useMirrorLayout({
  mirrorRef,
  onLayout,
  textareaRef,
  value,
}: {
  mirrorRef: React.RefObject<HTMLDivElement | null>;
  onLayout: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: unknown;
}) {
  const syncLayout = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) {
      return;
    }

    const style = textarea.ownerDocument.defaultView?.getComputedStyle(textarea);
    if (!style) {
      return;
    }

    const borderX = toPixels(style.borderLeftWidth) + toPixels(style.borderRightWidth);
    const borderY = toPixels(style.borderTopWidth) + toPixels(style.borderBottomWidth);
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + borderY}px`;

    for (const property of MIRRORED_PROPERTIES) {
      mirror.style.setProperty(property, style.getPropertyValue(property));
    }
    const scrollbarWidth = Math.max(
      0,
      textarea.offsetWidth - textarea.clientWidth - borderX
    );
    mirror.style.top = `${textarea.offsetTop}px`;
    mirror.style.left = `${textarea.offsetLeft}px`;
    mirror.style.width = `${textarea.offsetWidth - scrollbarWidth}px`;
    mirror.style.height = `${textarea.offsetHeight}px`;
    mirror.scrollTop = textarea.scrollTop;

    for (const chip of mirror.querySelectorAll<HTMLElement>('[data-custom]')) {
      chip.toggleAttribute('data-wrapped', chip.getClientRects().length > 1);
    }
    onLayout();
  }, [mirrorRef, onLayout, textareaRef]);

  useLayoutEffect(() => {
    syncLayout();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Lay out again whenever the text changes.
  }, [syncLayout, value]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const resizeObserver = new ResizeObserver(syncLayout);
    resizeObserver.observe(textarea);
    return () => resizeObserver.disconnect();
  }, [syncLayout, textareaRef]);

  return syncLayout;
}

type Segment =
  | {key: string; kind: 'text'; text: string}
  | {key: string; kind: 'anchor'; text: string}
  | {key: string; kind: 'mention'; mention: Mention};

/** Splits the text into plain runs, mentions, and the trigger anchor. */
function getSegments(
  text: string,
  mentions: readonly Mention[],
  anchor: TextRange | null
): Segment[] {
  const segments: Segment[] = [];
  const pushText = (start: number, end: number) => {
    if (start >= end) {
      return;
    }
    if (anchor && anchor.start < end && anchor.end > start) {
      const anchorStart = Math.max(start, anchor.start);
      const anchorEnd = Math.min(end, anchor.end);
      pushText(start, anchorStart);
      segments.push({
        key: `anchor-${anchorStart}`,
        kind: 'anchor',
        text: text.slice(anchorStart, anchorEnd),
      });
      pushText(anchorEnd, end);
      return;
    }
    segments.push({key: `text-${start}`, kind: 'text', text: text.slice(start, end)});
  };

  let offset = 0;
  for (const mention of mentions) {
    pushText(offset, mention.start);
    segments.push({key: `mention-${mention.start}`, kind: 'mention', mention});
    offset = mention.end;
  }
  pushText(offset, text.length);
  return segments;
}

interface MirrorProps {
  anchor: TextRange | null;
  disabled: boolean | undefined;
  mentions: readonly Mention[];
  ref: React.Ref<HTMLDivElement>;
  sourcesById: ReadonlyMap<string, ComposerSource<unknown>>;
  text: string;
}

export function Mirror({
  anchor,
  disabled,
  mentions,
  ref,
  sourcesById,
  text,
}: MirrorProps) {
  return (
    <ComposerMirror aria-hidden ref={ref} data-disabled={disabled ? '' : undefined}>
      {getSegments(text, mentions, anchor).map(segment => {
        switch (segment.kind) {
          case 'text':
            return segment.text;
          case 'anchor':
            return (
              <span key={segment.key} data-trigger-anchor="">
                {segment.text}
              </span>
            );
          case 'mention': {
            const {mention} = segment;
            const content = sourcesById.get(mention.sourceId)?.renderMention?.(mention);
            const isCustom = content !== undefined && content !== null;
            return (
              <MentionChip
                key={segment.key}
                data-mention=""
                data-source-id={mention.sourceId}
                data-custom={isCustom ? '' : undefined}
              >
                <span data-mention-text="">{mention.text}</span>
                {isCustom ? (
                  <MentionContent data-mention-content="">{content}</MentionContent>
                ) : null}
              </MentionChip>
            );
          }
          default:
            return null;
        }
      })}
      {/* Keeps a trailing empty line as tall as the textarea's. */}
      {'\u200B'}
    </ComposerMirror>
  );
}
