import {useEffect} from 'react';
import type {RefObject} from 'react';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ$#!%&*◆+@~^°±§¶×÷';
const LOWER = 'abcdefghijklmnopqrstuvwxyz$#!%&*◆+@~^°±§¶×÷';
const STAGGER_MS = 18;
const FADE_LEAD_MS = 60;

const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});

const UPPER_ARRAY = Array.from(UPPER);
const LOWER_ARRAY = Array.from(LOWER);

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? '$';
}

function randomGlyph(char: string): string {
  if (char >= 'a' && char <= 'z') {
    return pick(LOWER_ARRAY);
  }
  return pick(UPPER_ARRAY);
}

function isSimpleChar(grapheme: string): boolean {
  return grapheme.length === 1 && !/\s/.test(grapheme);
}

let styleInjected = false;
function ensureStyles() {
  if (styleInjected) {
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
    [data-text] {
      display: inline-grid;
      color: transparent;
      opacity: 0;
      transition: opacity 80ms ease-out;
    }
    [data-text].visible {
      opacity: 1;
    }
    [data-text]::after {
      content: attr(data-text);
      grid-area: 1 / 1;
      justify-self: center;
      width: 0;
      overflow: visible;
      text-align: center;
      color: var(--glyph-color, CanvasText);
      font: inherit;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

interface TextRun {
  active: boolean[];
  collapseCursor: number;
  globalOffset: number;
  graphemes: string[];
  original: string;
  spans: HTMLSpanElement[];
  wrapper: HTMLSpanElement;
}

function prepareTextNode(textNode: Text, globalOffset: number): TextRun | null {
  const original = textNode.nodeValue ?? '';
  if (!original.trim()) {
    return null;
  }

  const parent = textNode.parentNode;
  if (!parent) {
    return null;
  }

  const computedColor = getComputedStyle(parent as Element).color;
  const graphemes = Array.from(segmenter.segment(original), s => s.segment);

  const wrapper = document.createElement('span');
  wrapper.style.setProperty('--glyph-color', computedColor);

  const spans: HTMLSpanElement[] = [];
  const active: boolean[] = [];

  for (const grapheme of graphemes) {
    const span = document.createElement('span');
    span.textContent = grapheme;

    if (isSimpleChar(grapheme)) {
      span.dataset.text = randomGlyph(grapheme);
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

function animateElement(element: Element): void {
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
    return;
  }

  ensureStyles();

  const runs: TextRun[] = [];
  let globalIndex = 0;

  for (const textNode of textNodes) {
    const run = prepareTextNode(textNode, globalIndex);
    if (run) {
      runs.push(run);
      globalIndex += run.graphemes.length;
    }
  }

  if (runs.length === 0) {
    return;
  }

  const startTime = performance.now();

  function tick(now: number) {
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
        const settleAt = globalIdx * STAGGER_MS;
        const fadeAt = Math.max(0, settleAt - FADE_LEAD_MS);

        if (elapsed >= fadeAt) {
          span.classList.add('visible');
        }

        if (elapsed >= settleAt) {
          delete span.dataset.text;
          run.active[i] = false;
        } else {
          span.dataset.text = randomGlyph(grapheme);
          allSettled = false;
        }
      }

      collapseSettledPrefix(run);
    }

    if (allSettled) {
      for (const run of runs) {
        const restoredText = document.createTextNode(run.original);
        run.wrapper.replaceWith(restoredText);
      }
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

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

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof Element) {
            animateElement(addedNode);
          }
        }
      }
    });

    observer.observe(container, {childList: true});

    return () => observer.disconnect();
  }, [containerRef, enabled]);
}
