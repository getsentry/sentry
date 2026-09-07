import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useOrganization} from 'sentry/utils/useOrganization';
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

// Floor size for the data panel, big enough to read JSON comfortably even
// when the selected node's own box (a small nav badge, a label chip) is
// much smaller.
const PANEL_MIN_WIDTH = 420;
const PANEL_MIN_HEIGHT = 320;

// Approximate rendered height of NodeLabel (font-size xs * line-height 1.5 +
// vertical padding + border). Below this much room above a node's box, the
// label has nowhere to go if placed above it, so it flips to render below
// instead — otherwise it renders off-screen and unclickable for anything
// pinned near the top of the viewport (e.g. primary/secondary nav).
const LABEL_HEIGHT_PX = 20;

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
  // Registration always threads `parentId` from the nearest ANCESTOR in the
  // render tree, so a cycle can't arise from normal usage — this guards
  // against it anyway, since a stray cycle would otherwise recurse forever
  // and crash the whole overlay instead of just mis-rendering one node.
  const visiting = new Set<string>();

  function depthOf(nodeId: string): number {
    const cached = depths.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(nodeId)) {
      depths.set(nodeId, 0);
      return 0;
    }
    visiting.add(nodeId);
    const node = byId.get(nodeId);
    const depth = node?.parentId ? depthOf(node.parentId) + 1 : 0;
    visiting.delete(nodeId);
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
  const persistedEnabled = useXRayModeEnabled();
  // Mounted at the app root, before any route is guaranteed to have loaded
  // an organization — allowNull instead of the throwing default.
  const organization = useOrganization({allowNull: true});
  // The cmd+k toggle is the only UI for turning this off, and it's already
  // hidden without the flag — so a stale `'1'` left over in localStorage
  // (e.g. from before the org lost access) must not keep the overlay live
  // with no way to disable it. The flag is the hard gate; localStorage only
  // toggles within that.
  const enabled =
    persistedEnabled && (organization?.features.includes('seer-xray') ?? false);
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

    // Scroll/resize can fire many times per frame; coalesce bursts into at
    // most one measure-and-render per animation frame instead of thrashing
    // layout on every event.
    let rafId: number | null = null;
    function scheduleRecompute() {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        recompute();
      });
    }

    recompute();
    const intervalId = window.setInterval(recompute, POLL_INTERVAL_MS);
    window.addEventListener('resize', scheduleRecompute);
    // capture: layout-affecting scrolls commonly happen in nested containers
    // (a panel, a table), which don't bubble scroll events to window.
    window.addEventListener('scroll', scheduleRecompute, true);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('resize', scheduleRecompute);
      window.removeEventListener('scroll', scheduleRecompute, true);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, getOverlayNodes]);

  if (!enabled) {
    return null;
  }

  const selectedNode = measured.find(node => node.nodeId === selectedNodeId);

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
              flip={node.rect.top < LABEL_HEIGHT_PX}
              onClick={() => setSelectedNodeId(isSelected ? null : node.nodeId)}
            >
              {node.nodeType}
            </NodeLabel>
          </NodeBox>
        );
      })}
      {/* Rendered last (and outside every NodeBox) so it always paints on
          top of every box's own content, regardless of which node — shallow
          or deep — it belongs to. */}
      {selectedNode && (
        <NodeDataPanel
          style={{
            top: selectedNode.rect.top,
            left: selectedNode.rect.left,
            // A small node's box (a nav badge, a label chip) is too small to
            // hold readable JSON, so the panel keeps a fixed, reasonable
            // floor size and is allowed to extend past that box — CSS lets
            // min win over a smaller max here, same as any tooltip or
            // popover anchored to a small trigger. Large nodes still cap the
            // panel to their own box via max-width/max-height, so it never
            // grows arbitrarily big for a big section.
            minWidth: PANEL_MIN_WIDTH,
            minHeight: PANEL_MIN_HEIGHT,
            maxWidth: selectedNode.rect.width,
            maxHeight: selectedNode.rect.height,
          }}
        >
          <NodeDataPanelTitle>{selectedNode.nodeType}</NodeDataPanelTitle>
          <NodeDataPanelBody>
            {JSON.stringify(selectedNode.data, null, 2)}
          </NodeDataPanelBody>
        </NodeDataPanel>
      )}
    </Container>,
    document.body
  );
}

const Container = styled('div')`
  position: fixed;
  inset: 0;
  /* Above ordinary page content, but always below the cmd+k command palette
     (which renders as a modal at theme.zIndex.modal) — XRay must never
     obscure it. Derived from the token rather than a hardcoded number so
     this relationship holds even if the modal layer's value changes. */
  z-index: ${p => p.theme.zIndex.modal - 1};
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

const NodeLabel = styled('button')<{color: (typeof DEPTH_COLORS)[number]; flip: boolean}>`
  position: absolute;
  left: 0;
  ${p =>
    p.flip
      ? css`
          /* Anchored to the box's own top edge (which is near the
             viewport's top — that's what triggers the flip), not its
             bottom: a nav box can be viewport-height tall, and \`top: 100%\`
             would put the label at the bottom of the page instead. */
          top: 0;
          border-radius: 0 0 ${p.theme.radius.xs} ${p.theme.radius.xs};
        `
      : css`
          top: 0;
          transform: translateY(-100%);
          border-radius: ${p.theme.radius.xs} ${p.theme.radius.xs} 0 0;
        `}
  pointer-events: auto;
  cursor: pointer;
  border: none;
  padding: 1px 6px;
  background: ${p => p.theme.colors[p.color]};
  color: ${p => p.theme.colors.white};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  line-height: 1.5;
  white-space: nowrap;
`;

const NodeDataPanel = styled('div')`
  position: fixed;
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
