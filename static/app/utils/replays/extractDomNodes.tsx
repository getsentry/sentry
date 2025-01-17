import type {Mirror} from '@sentry-internal/rrweb-snapshot';

import type {ReplayFrame} from 'sentry/utils/replays/types';
import {getNodeIds} from 'sentry/utils/replays/types';
import constructSelector from 'sentry/views/replays/deadRageClick/constructSelector';

export type Extraction = {
  frame: ReplayFrame;
  html: string[];
  selectors: Map<number, string>;
  timestamp: number;
};

const extractDomNodes = {
  shouldVisitFrame: (frame: any) => {
    const nodeIds = getNodeIds(frame);
    return nodeIds.filter((nodeId: any) => nodeId !== -1).length > 0;
  },
  onVisitFrame: (frame: any, collection: any, replayer: any) => {
    const mirror = replayer.getMirror();
    const nodeIds = getNodeIds(frame);
    const {html, selectors} = extractHtmlAndSelector((nodeIds ?? []) as number[], mirror);
    collection.set(frame as ReplayFrame, {
      frame,
      html,
      selectors,
      timestamp: frame.timestampMs,
    });
  },
};

export default extractDomNodes;

function extractHtmlAndSelector(
  nodeIds: number[],
  mirror: Mirror
): {html: string[]; selectors: Map<number, string>} {
  const htmlStrings: string[] = [];
  const selectors = new Map<number, string>();
  for (const nodeId of nodeIds) {
    const node = mirror.getNode(nodeId);
    if (node) {
      const html = extractHtml(node);
      if (html) {
        htmlStrings.push(html);
      }

      const selector = extractSelector(node);
      if (selector) {
        selectors.set(nodeId, selector);
      }
    }
  }
  return {html: htmlStrings, selectors};
}

function extractHtml(node: Node): string | null {
  const html =
    ('outerHTML' in node ? (node.outerHTML as string) : node.textContent) || '';
  // Limit document node depth to 2
  let truncated = removeNodesAtLevel(html, 2);
  // If still very long and/or removeNodesAtLevel failed, truncate
  if (truncated.length > 1500) {
    truncated = truncated.substring(0, 1500);
  }
  if (truncated) {
    return truncated;
  }
  return null;
}

function extractSelector(node: Node): string | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;

  if (element) {
    return constructSelector({
      alt: element.attributes.getNamedItem('alt')?.nodeValue ?? '',
      aria_label: element.attributes.getNamedItem('aria-label')?.nodeValue ?? '',
      class: element.attributes.getNamedItem('class')?.nodeValue?.split(' ') ?? [],
      component_name:
        element.attributes.getNamedItem('data-sentry-component')?.nodeValue ?? '',
      id: element.id,
      role: element.attributes.getNamedItem('role')?.nodeValue ?? '',
      tag: element.tagName.toLowerCase(),
      testid: element.attributes.getNamedItem('data-test-id')?.nodeValue ?? '',
      title: element.attributes.getNamedItem('title')?.nodeValue ?? '',
    }).selector;
  }

  return null;
}

function removeChildLevel(max: number, collection: HTMLCollection, current: number = 0) {
  for (let i = 0; i < collection.length; i++) {
    const child = collection[i]!;
    if (child.nodeName === 'STYLE') {
      child.textContent = '/* Inline CSS */';
    }
    if (child.nodeName === 'svg') {
      child.innerHTML = '<!-- SVG -->';
    }
    if (max <= current) {
      if (child.childElementCount > 0) {
        child.innerHTML = `<!-- ${child.childElementCount} descendents -->`;
      }
    } else {
      removeChildLevel(max, child.children, current + 1);
    }
  }
}

function removeNodesAtLevel(html: string, level: number): string {
  const parser = new DOMParser();

  try {
    const doc = parser.parseFromString(html, 'text/html');
    removeChildLevel(level, doc.body.children);
    return doc.body.innerHTML;
  } catch (err) {
    // If we can't parse the HTML, just return the original
    return html;
  }
}
