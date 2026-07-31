import {useEffect} from 'react';
import type {RefObject} from 'react';
import {css, keyframes} from '@emotion/react';
import {useReducedMotion} from 'framer-motion';

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
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (prefersReducedMotion) {
      return;
    }

    let activeAnimations: Array<{destroy: () => void; settle: () => void}> = [];

    const observer = new MutationObserver(mutations => {
      for (const anim of activeAnimations) {
        anim.settle();
      }
      activeAnimations = [];

      const newElements: HTMLElement[] = [];
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof HTMLElement) {
            newElements.push(addedNode);
          }
        }
      }

      // Sequence animations across block-level elements so paragraphs
      // arriving in the same poll reveal one after another, not all at once.
      let charOffset = 0;
      for (const el of newElements) {
        const skip = Number.parseInt(el.dataset.skip ?? '0', 10);
        const totalChars = (el.textContent ?? '').length;
        activeAnimations.push(animateElement(el, charOffset));
        charOffset += Math.max(0, totalChars - skip);
      }
    });

    observer.observe(container, {childList: true});

    return () => {
      observer.disconnect();
      for (const anim of activeAnimations) {
        anim.destroy();
      }
      activeAnimations = [];
    };
  }, [containerRef, enabled, prefersReducedMotion]);
}

const STAGGER_MS = 8;
const FADE_LEAD_MS = 120;
const MAX_DURATION_MS = 1280;
const CYCLE_DURATION_MS = 160;

const ATTR = 'data-scraps-decode';
const ATTR_SEL = `[${ATTR}]`;

const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
const DUMMY_WRAPPER = document.createElement('span');

function isSimpleChar(grapheme: string): boolean {
  return grapheme.length === 1 && !/\s/.test(grapheme);
}

// not used as colors, just the hex values
const DECODE_PATTERNS = ['#7553FF', '#00F261', '#FC5CB4'];
const DECODE_ANIMATIONS = DECODE_PATTERNS.map(chars => {
  const glyphs = Array.from(chars);
  const step = Math.floor(100 / glyphs.length);
  return keyframes(
    Object.fromEntries(glyphs.map((ch, i) => [`${i * step}%`, {content: `'${ch}'`}]))
  );
});

export const streamingAnimationStyles = css`
  ${DECODE_ANIMATIONS}
  ${ATTR_SEL} {
    position: relative;
    color: transparent;
    contain: style paint;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  ${ATTR_SEL}.visible {
    opacity: var(--go, 1);
  }
  [data-streaming-hidden] {
    opacity: 0;
  }
  ${ATTR_SEL}::after {
    content: '1';
    animation: var(--da, ${DECODE_ANIMATIONS[0]?.name}) ${CYCLE_DURATION_MS}ms steps(1)
      infinite;
    animation-delay: var(--dd, 0ms);
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: var(--glyph-color, CanvasText);
    font: inherit;
    pointer-events: none;
  }
`;

interface TextRun {
  active: boolean[];
  collapseCursor: number;
  decoratedAncestors: Element[];
  globalOffset: number;
  graphemes: string[];
  original: string;
  revealed: boolean;
  spans: HTMLSpanElement[];
  wrapper: HTMLSpanElement;
}

function prepareTextNode(
  textNode: Text,
  globalOffset: number,
  skipChars: number,
  root: Element
): TextRun | null {
  const original = textNode.nodeValue ?? '';
  if (!original.trim()) {
    return null;
  }

  const parent = textNode.parentNode;
  if (!parent) {
    return null;
  }
  const decoratedAncestors: Element[] = [];
  let ancestor = parent instanceof Element ? parent : null;
  while (ancestor && ancestor !== root) {
    decoratedAncestors.push(ancestor);
    ancestor = ancestor.parentElement;
  }
  const graphemes = Array.from(segmenter.segment(original), s => s.segment);

  if (globalOffset + graphemes.length <= skipChars) {
    return {
      original,
      wrapper: DUMMY_WRAPPER,
      spans: [],
      graphemes,
      active: [],
      globalOffset,
      collapseCursor: 0,
      decoratedAncestors,
      revealed: true,
    };
  }

  const computedColor = getComputedStyle(parent as Element).color;
  const wrapper = document.createElement('span');
  wrapper.style.setProperty('--glyph-color', computedColor);
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
      span.setAttribute(ATTR, '');
      const s = span.style;
      s.setProperty('--dd', `-${Math.random() * CYCLE_DURATION_MS}ms`);
      s.setProperty(
        '--da',
        DECODE_ANIMATIONS[idx % DECODE_ANIMATIONS.length]?.name ??
          DECODE_ANIMATIONS[0]?.name ??
          ''
      );
      s.setProperty('--go', `${0.4 + Math.random() * 0.6}`);
      active.push(true);
    } else {
      active.push(false);
    }

    spans.push(span);
    wrapper.appendChild(span);
  }

  textNode.replaceWith(wrapper);

  return {
    original,
    wrapper,
    spans,
    graphemes,
    active,
    globalOffset,
    collapseCursor: 0,
    decoratedAncestors,
    revealed: !active.includes(true),
  };
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

function fadeOutRuns(runs: TextRun[]): ReturnType<typeof setTimeout> {
  for (const run of runs) {
    for (let i = run.collapseCursor; i < run.spans.length; i++) {
      const span = run.spans[i];
      if (span) {
        span.removeAttribute(ATTR);
        span.classList.add('visible');
      }
    }
  }
  return setTimeout(() => restoreRuns(runs), 200);
}

const scheduleIdle: (cb: () => void) => number | ReturnType<typeof setTimeout> =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : cb => setTimeout(cb, 0);
const cancelIdle: (id: number | ReturnType<typeof setTimeout>) => void =
  typeof cancelIdleCallback === 'function'
    ? id => cancelIdleCallback(id as number)
    : id => clearTimeout(id);

interface Animation {
  destroy: () => void;
  settle: () => void;
}

const NOOP_ANIMATION: Animation = {settle() {}, destroy() {}};

function animateElement(element: HTMLElement, charOffset = 0): Animation {
  const skipChars = Number.parseInt(element.dataset.skip ?? '0', 10);
  delete element.dataset.skip;

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
    return NOOP_ANIMATION;
  }

  const runs: TextRun[] = [];
  let globalIndex = 0;

  for (const textNode of textNodes) {
    const run = prepareTextNode(textNode, globalIndex, skipChars, element);
    if (run) {
      runs.push(run);
      globalIndex += run.graphemes.length;
    }
  }

  if (runs.length === 0) {
    return NOOP_ANIMATION;
  }

  // Only hide ancestors exclusive to active runs — shared ancestors
  // (e.g. a <p> containing both old and new text) must stay visible.
  const sharedAncestors = new Set<Element>();
  for (const run of runs) {
    if (run.revealed) {
      for (const el of run.decoratedAncestors) {
        sharedAncestors.add(el);
      }
    }
  }
  for (const run of runs) {
    if (!run.revealed) {
      for (const el of run.decoratedAncestors) {
        if (!sharedAncestors.has(el)) {
          el.setAttribute('data-streaming-hidden', '');
        }
      }
    }
  }

  let settled = false;
  const startTime = performance.now();

  let pendingIdle: number | ReturnType<typeof setTimeout> | null = null;
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleCollapse() {
    if (pendingIdle !== null) {
      return;
    }
    pendingIdle = scheduleIdle(() => {
      pendingIdle = null;
      if (settled) {
        return;
      }
      for (const run of runs) {
        collapseSettledPrefix(run);
      }
    });
  }

  function revealAll() {
    for (const run of runs) {
      for (const el of run.decoratedAncestors) {
        el.removeAttribute('data-streaming-hidden');
      }
    }
  }

  function settle() {
    if (settled) {
      return;
    }
    settled = true;
    revealAll();
    if (pendingIdle !== null) {
      cancelIdle(pendingIdle);
      pendingIdle = null;
    }
    for (const run of runs) {
      collapseSettledPrefix(run);
    }
    fadeTimeout = fadeOutRuns(runs);
  }

  function destroy() {
    if (!settled) {
      settled = true;
      if (pendingIdle !== null) {
        cancelIdle(pendingIdle);
        pendingIdle = null;
      }
    }
    if (fadeTimeout !== null) {
      clearTimeout(fadeTimeout);
      fadeTimeout = null;
    }
    revealAll();
    restoreRuns(runs);
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
        const settleAt = (animatedIdx + charOffset) * STAGGER_MS;
        const fadeAt = Math.max(0, settleAt - FADE_LEAD_MS);

        if (elapsed >= fadeAt) {
          span.classList.add('visible');
          if (!run.revealed) {
            run.revealed = true;
            for (const el of run.decoratedAncestors) {
              el.removeAttribute('data-streaming-hidden');
            }
          }
        }

        if (elapsed >= settleAt) {
          span.removeAttribute(ATTR);
          run.active[i] = false;
        } else {
          allSettled = false;
        }
      }
    }

    scheduleCollapse();

    if (allSettled || elapsed >= MAX_DURATION_MS + charOffset * STAGGER_MS) {
      settle();
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
  return {settle, destroy};
}
