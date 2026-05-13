import {useEffect} from 'react';
import type {RefObject} from 'react';
import {css} from '@emotion/react';

/**
 * Imperative streaming decode animation for Markdown.
 *
 * This hook animates new block-level children with a glyph-shuffle reveal
 * effect. It operates entirely on the DOM after React commits, avoiding any
 * changes to the Token/renderInline rendering pipeline.
 *
 * Why imperative:
 *   Threading an `animated` prop through Token, renderInline, and every
 *   recursive inline case would couple the animation to the rendering layer.
 *   Instead, a MutationObserver detects new direct children of the container,
 *   and a rAF loop handles the per-character animation on the committed DOM.
 *
 * Layout:
 *   Each character is wrapped in a <span> whose text content is the real
 *   character (holds width, invisible via `color: transparent`). A `::after`
 *   pseudo-element driven by `data-decode-glyph` overlays the cycling glyph,
 *   centered horizontally via `left: 50%; transform: translateX(-50%)`.
 *   This keeps layout stable regardless of glyph width.
 *
 * Accessibility:
 *   The real character is always the span's text content — assistive tech
 *   reads it normally. The glyph overlay is purely visual (::after with
 *   pointer-events: none). Respects `prefers-reduced-motion: reduce`.
 *
 * Cleanup:
 *   Settled characters are progressively collapsed back to plain text nodes
 *   at whitespace boundaries. When the animation completes (or is preempted
 *   by a newer block), all remaining spans are restored to text nodes.
 */
export function useStreamingAnimation(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let activeSettles: Array<() => void> = [];

    const observer = new MutationObserver(mutations => {
      for (const settle of activeSettles) {
        settle();
      }
      activeSettles = [];

      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof Element) {
            const settle = animateElement(addedNode);
            activeSettles.push(settle);
          }
        }
      }
    });

    observer.observe(container, {childList: true});

    return () => observer.disconnect();
  }, [containerRef, enabled]);
}

const CHAR_ARRAY = Array.from('0123456789ABCDEF#');
const STAGGER_MS = 11;
const FADE_LEAD_MS = 200;
const MAX_DURATION_MS = 1200;

const ATTR = 'data-scraps-decode';
const ATTR_SEL = `[${ATTR}]`;

const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? '0';
}

function randomGlyph(): string {
  return pick(CHAR_ARRAY);
}

function isSimpleChar(grapheme: string): boolean {
  return grapheme.length === 1 && !/\s/.test(grapheme);
}

export const streamingAnimationStyles = css`
  ${ATTR_SEL} {
    position: relative;
    color: transparent;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  ${ATTR_SEL}.visible {
    opacity: 1;
  }
  ${ATTR_SEL}::after {
    content: attr(${ATTR});
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: inherit;
    font: inherit;
    pointer-events: none;
  }
`;

interface TextRun {
  active: boolean[];
  collapseCursor: number;
  globalOffset: number;
  graphemes: string[];
  original: string;
  spans: HTMLSpanElement[];
  wrapper: HTMLSpanElement;
}

function prepareTextNode(
  textNode: Text,
  globalOffset: number,
  skipChars: number
): TextRun | null {
  const original = textNode.nodeValue ?? '';
  if (!original.trim()) {
    return null;
  }

  const parent = textNode.parentNode;
  if (!parent) {
    return null;
  }
  const graphemes = Array.from(segmenter.segment(original), s => s.segment);

  const wrapper = document.createElement('span');
  const spans: HTMLSpanElement[] = [];
  const active: boolean[] = [];

  for (let idx = 0; idx < graphemes.length; idx++) {
    const grapheme = graphemes[idx];
    if (!grapheme) {
      continue;
    }

    const span = document.createElement('span');
    span.textContent = grapheme;

    if (isSimpleChar(grapheme) && globalOffset + idx >= skipChars) {
      span.setAttribute(ATTR, randomGlyph());
      active.push(true);
    } else {
      active.push(false);
    }

    spans.push(span);
    wrapper.appendChild(span);
  }

  textNode.replaceWith(wrapper);

  return {original, wrapper, spans, graphemes, active, globalOffset, collapseCursor: 0};
}

function collapseSettledPrefix(run: TextRun) {
  let collapseEnd = run.collapseCursor;

  for (let j = run.collapseCursor; j < run.spans.length; j++) {
    if (run.active[j]) {
      break;
    }
    const g = run.graphemes[j];
    if (g && /\s/.test(g)) {
      collapseEnd = j + 1;
    }
  }

  if (collapseEnd <= run.collapseCursor) {
    return;
  }

  const text = run.graphemes.slice(run.collapseCursor, collapseEnd).join('');
  const node = document.createTextNode(text);
  const firstSpan = run.spans[run.collapseCursor];

  if (firstSpan) {
    firstSpan.replaceWith(node);
  }
  for (let j = run.collapseCursor + 1; j < collapseEnd; j++) {
    run.spans[j]?.remove();
  }

  run.collapseCursor = collapseEnd;
}

function restoreRuns(runs: TextRun[]) {
  for (const run of runs) {
    const restoredText = document.createTextNode(run.original);
    run.wrapper.replaceWith(restoredText);
  }
}

function fadeOutRuns(runs: TextRun[]) {
  for (const run of runs) {
    for (let i = run.collapseCursor; i < run.spans.length; i++) {
      const span = run.spans[i];
      if (span) {
        span.removeAttribute(ATTR);
        span.classList.add('visible');
      }
    }
  }
  setTimeout(() => restoreRuns(runs), 200);
}

function animateElement(element: Element): () => void {
  const htmlEl = element as HTMLElement;
  const skipChars = parseInt(htmlEl.dataset.skip ?? '0', 10);
  delete htmlEl.dataset.skip;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node = walker.nextNode();
  while (node !== null) {
    if (node.textContent?.trim()) {
      textNodes.push(node as Text);
    }
    node = walker.nextNode();
  }

  if (textNodes.length === 0) {
    return () => {};
  }

  const runs: TextRun[] = [];
  let globalIndex = 0;

  for (const textNode of textNodes) {
    const run = prepareTextNode(textNode, globalIndex, skipChars);
    if (run) {
      runs.push(run);
      globalIndex += run.graphemes.length;
    }
  }

  if (runs.length === 0) {
    return () => {};
  }

  let settled = false;
  const startTime = performance.now();

  function settle() {
    if (settled) {
      return;
    }
    settled = true;
    fadeOutRuns(runs);
  }

  function tick(now: number) {
    if (settled) {
      return;
    }

    const elapsed = now - startTime;
    let allSettled = true;

    for (const run of runs) {
      for (let i = run.collapseCursor; i < run.spans.length; i++) {
        if (!run.active[i]) {
          continue;
        }

        const span = run.spans[i];
        const grapheme = run.graphemes[i];
        if (!span || !grapheme) {
          continue;
        }

        const globalIdx = run.globalOffset + i;
        const animatedIdx = globalIdx - skipChars;
        const settleAt = animatedIdx * STAGGER_MS;
        const fadeAt = Math.max(0, settleAt - FADE_LEAD_MS);

        if (elapsed >= fadeAt) {
          span.classList.add('visible');
        }

        if (elapsed >= settleAt) {
          span.removeAttribute(ATTR);
          run.active[i] = false;
        } else {
          span.setAttribute(ATTR, randomGlyph(grapheme));
          allSettled = false;
        }
      }

      collapseSettledPrefix(run);
    }

    if (allSettled || elapsed >= MAX_DURATION_MS) {
      settle();
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
  return settle;
}
