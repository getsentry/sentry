import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {useLLMContextRegistry} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {LLMContextOverlayNode} from 'sentry/views/seerExplorer/contexts/llmContextTypes';

import {useXRayModeEnabled} from './xrayModeStore';

/**
 * Seer XRay Mode
 *
 * Renders a translucent, read-only overlay on top of the live page, drawing
 * one box per node registered in the LLM context tree (`LLMInternalContext`)
 * at that node's real screen position — so an engineer can see exactly what
 * Seer "sees" without leaving the page or opening devtools.
 *
 * Positions come from the DOM anchor `registerLLMContext` attaches to each
 * node (`data-seer-xray-node-id`), not from the registry itself — the
 * registry only knows about the LLM-context tree, not layout. Measurement
 * re-runs on a short poll plus resize/scroll, since node content can resize
 * without ever touching `useLLMContext` (a loading chart, a lazy list).
 */

const POLL_INTERVAL_MS = 500;

// Cycled by nesting depth so a parent and its children are visually distinct
// even when their boxes overlap almost exactly (e.g. a widget with one child chart).
const DEPTH_COLORS = ['blue400', 'pink400', 'yellow400', 'green400'] as const;

// Above every existing z-index layer (modals, drawers, tooltips) — XRay must
// be able to highlight nodes rendered inside any of them too.
const OVERLAY_Z_INDEX = 2_147_483_000;

interface MeasuredNode extends LLMContextOverlayNode {
  depth: number;
  rect: DOMRect;
}

function measureRect(el: Element): DOMRect | null {
  // `registerLLMContext`'s anchor is `display: contents` and generates no
  // box of its own — a Range over its contents gives the union rect of
  // whatever it wraps instead, which is what we actually want to highlight.
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : null;
}

function computeDepths(nodes: LLMContextOverlayNode[]): Map<string, number> {
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const depths = new Map<string, number>();

  function depthOf(nodeId: string): number {
    const cached = depths.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }
    const node = byId.get(nodeId);
    const depth = node?.parentId ? depthOf(node.parentId) + 1 : 0;
    depths.set(nodeId, depth);
    return depth;
  }

  nodes.forEach(node => depthOf(node.nodeId));
  return depths;
}

function measureAllNodes(nodes: LLMContextOverlayNode[]): MeasuredNode[] {
  const depths = computeDepths(nodes);
  const elementById = new Map<string, Element>();
  document.querySelectorAll('[data-seer-xray-node-id]').forEach(el => {
    const id = el.getAttribute('data-seer-xray-node-id');
    if (id) {
      elementById.set(id, el);
    }
  });

  const measured: MeasuredNode[] = [];
  for (const node of nodes) {
    const el = elementById.get(node.nodeId);
    const rect = el ? measureRect(el) : null;
    if (!rect) {
      continue;
    }
    measured.push({...node, rect, depth: depths.get(node.nodeId) ?? 0});
  }

  // Deepest first: later boxes paint on top, so a child's outline and label
  // stay visible instead of being covered by its (larger) parent box.
  return measured.sort((a, b) => a.depth - b.depth);
}

export function SeerXRayOverlay() {
  const enabled = useXRayModeEnabled();
  const {getOverlayNodes} = useLLMContextRegistry();
  const [measured, setMeasured] = useState<MeasuredNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMeasured([]);
      setSelectedNodeId(null);
      return;
    }

    function recompute() {
      setMeasured(measureAllNodes(getOverlayNodes()));
    }

    recompute();
    const intervalId = window.setInterval(recompute, POLL_INTERVAL_MS);
    window.addEventListener('resize', recompute);
    // capture: layout-affecting scrolls commonly happen in nested containers
    // (a panel, a table), which don't bubble scroll events to window.
    window.addEventListener('scroll', recompute, true);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [enabled, getOverlayNodes]);

  if (!enabled) {
    return null;
  }

  return createPortal(
    <Container>
      {measured.map(node => {
        const color = DEPTH_COLORS[node.depth % DEPTH_COLORS.length] ?? DEPTH_COLORS[0];
        const isSelected = node.nodeId === selectedNodeId;
        return (
          <NodeBox
            key={node.nodeId}
            color={color}
            style={{
              top: node.rect.top,
              left: node.rect.left,
              width: node.rect.width,
              height: node.rect.height,
            }}
          >
            <NodeLabel
              color={color}
              onClick={() => setSelectedNodeId(isSelected ? null : node.nodeId)}
            >
              {node.nodeType}
            </NodeLabel>
            {isSelected && (
              <NodeDataPanel>
                <NodeDataPanelTitle>{node.nodeType}</NodeDataPanelTitle>
                <NodeDataPanelBody>
                  {JSON.stringify(node.data, null, 2)}
                </NodeDataPanelBody>
              </NodeDataPanel>
            )}
          </NodeBox>
        );
      })}
    </Container>,
    document.body
  );
}

const Container = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z_INDEX};
  /* Boxes opt back into pointer-events individually (the label, the data
     panel) — everywhere else, clicks pass through to the real page. */
  pointer-events: none;
`;

const NodeBox = styled('div')<{color: (typeof DEPTH_COLORS)[number]}>`
  position: fixed;
  box-sizing: border-box;
  border: 1px solid ${p => p.theme.colors[p.color]};
  background: ${p => p.theme.colors[p.color]}1a;
`;

const NodeLabel = styled('button')<{color: (typeof DEPTH_COLORS)[number]}>`
  position: absolute;
  top: 0;
  left: 0;
  transform: translateY(-100%);
  pointer-events: auto;
  cursor: pointer;
  border: none;
  border-radius: ${p => p.theme.radius.xs} ${p => p.theme.radius.xs} 0 0;
  padding: 1px 6px;
  background: ${p => p.theme.colors[p.color]};
  color: ${p => p.theme.colors.white};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  line-height: 1.5;
  white-space: nowrap;
`;

const NodeDataPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  max-width: 420px;
  max-height: 320px;
  overflow: auto;
  pointer-events: auto;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.high};
`;

const NodeDataPanelTitle = styled('div')`
  position: sticky;
  top: 0;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.mono.medium};
`;

const NodeDataPanelBody = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  white-space: pre-wrap;
  word-break: break-word;
`;
