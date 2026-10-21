import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {MarkedLexer, markdownToPlainText, type Token} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {scrollIntoViewBelowTopBar} from 'sentry/utils/scrollIntoViewBelowTopBar';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getBlockElementId,
  getCellHeadingElement,
  getTextCellMarkdown,
  isBlockWorking,
} from 'sentry/views/investigations/detail/cell';
import type {InvestigationBlock} from 'sentry/views/investigations/types';
import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';

export const SUMMARY_ELEMENT_ID = 'investigation-summary';
export const HYPOTHESES_ELEMENT_ID = 'investigation-hypotheses';
export const ACTIVITY_ELEMENT_ID = 'investigation-activity';

/** Space kept between the top bar and the outline, and whatever it scrolls to. */
const OFFSET_BELOW_TOP_BAR = 16;

/** How long the page goes without scrolling before a jump counts as finished. */
const SCROLL_SETTLE_MS = 150;

export type InvestigationOutlineEntry = {
  /** Unique within the outline. */
  key: string;
  kind: 'summary' | 'hypotheses' | 'heading' | 'activity';
  label: string;
  /** Whether the entry sits under the heading above it. */
  nested: boolean;
  /**
   * A cell heading points at its cell and its position among the cell's
   * headings, or at the whole cell for a title that stands in for one. Anything
   * else points at an element on the page.
   */
  target: {blockId: string; headingIndex: number | null} | {elementId: string};
};

type CellHeading = {
  blockId: string;
  /** Null for a title standing in for a heading the cell hasn't written yet. */
  depth: number | null;
  headingIndex: number | null;
  label: string;
};

/**
 * The page's sections and the headings in its text cells, in page order.
 *
 * Empty when the cells have fewer than two headings between them: a report
 * that short has nothing to find your way around.
 */
export function getInvestigationOutline({
  blocks,
  hasActivity,
  hasHypotheses,
  hasSummary,
}: {
  blocks: InvestigationBlock[];
  hasActivity: boolean;
  hasHypotheses: boolean;
  hasSummary: boolean;
}): InvestigationOutlineEntry[] {
  const headings = blocks.flatMap(getCellHeadings).filter(heading => heading.label);
  // Seer opens every section with an h2, but a cell someone wrote can use any
  // level, so the outline keeps the shallowest level in use and the one below.
  const topDepth = Math.min(
    ...headings.flatMap(heading => (heading.depth === null ? [] : [heading.depth]))
  );
  const cellEntries = headings
    .filter(heading => heading.depth === null || heading.depth <= topDepth + 1)
    .map((heading): InvestigationOutlineEntry => ({
      key: `${heading.blockId}:${heading.headingIndex ?? 'title'}`,
      kind: 'heading',
      label: heading.label,
      nested: heading.depth !== null && heading.depth > topDepth,
      target: {blockId: heading.blockId, headingIndex: heading.headingIndex},
    }));
  if (cellEntries.length < 2) {
    return [];
  }

  return [
    ...(hasSummary ? [getSectionEntry('summary', t('Summary'), SUMMARY_ELEMENT_ID)] : []),
    ...(hasHypotheses
      ? [getSectionEntry('hypotheses', t('Hypotheses'), HYPOTHESES_ELEMENT_ID)]
      : []),
    ...cellEntries,
    ...(hasActivity
      ? [getSectionEntry('activity', t('Activity'), ACTIVITY_ELEMENT_ID)]
      : []),
  ];
}

function getSectionEntry(
  kind: 'summary' | 'hypotheses' | 'activity',
  label: string,
  elementId: string
): InvestigationOutlineEntry {
  return {key: kind, kind, label, nested: false, target: {elementId}};
}

function getCellHeadings(block: InvestigationBlock): CellHeading[] {
  if (block.kind !== 'text') {
    return [];
  }
  const markdown = getTextCellMarkdown(block);
  if (markdown) {
    return getMarkdownHeadings(markdown).map((heading, headingIndex) => ({
      blockId: block.id,
      depth: heading.depth,
      headingIndex,
      label: heading.label,
    }));
  }
  // Until Seer writes the cell, it shows its title above a placeholder.
  const title = block.title.trim();
  return isBlockWorking(block) && title
    ? [{blockId: block.id, depth: null, headingIndex: null, label: title}]
    : [];
}

/**
 * Every heading the Markdown renders, in order. Headings inside block quotes
 * and lists render too, so it walks into those.
 */
function getMarkdownHeadings(markdown: string) {
  const headings: Array<{depth: number; label: string}> = [];
  function visit(tokens: Token[]) {
    for (const token of tokens) {
      if (token.type === 'heading') {
        headings.push({depth: token.depth, label: markdownToPlainText(token.text)});
        continue;
      }
      const nested = token as {items?: Token[]; tokens?: Token[]};
      visit(nested.items ?? nested.tokens ?? []);
    }
  }
  visit(MarkedLexer.lex(markdown));
  return headings;
}

function getTargetId({target}: InvestigationOutlineEntry) {
  return 'elementId' in target ? target.elementId : getBlockElementId(target.blockId);
}

function getTargetElement(entry: InvestigationOutlineEntry) {
  const {target} = entry;
  const heading =
    'blockId' in target && target.headingIndex !== null
      ? getCellHeadingElement(target.blockId, target.headingIndex)
      : null;
  // A cell rewriting itself shows streamed text, whose headings may not line up
  // with the settled ones the outline was built from, so fall back to the cell.
  return heading ?? document.getElementById(getTargetId(entry));
}

/**
 * The entry for the part of the page being read: the last one whose target has
 * scrolled into the top quarter of the viewport, once the first has started
 * scrolling away.
 *
 * An entry someone picks stays current while the page scrolls to it, and until
 * the page next scrolls after that, since a short section at the end can't
 * scroll far enough up to take over.
 */
function useActiveEntry(entries: InvestigationOutlineEntry[]) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const pick = useRef<{settled: boolean; timeout: number} | null>(null);

  useEffect(() => {
    let frame: number | null = null;
    function update() {
      frame = null;
      if (pick.current) {
        return;
      }
      const threshold = window.innerHeight / 4;
      const tops = entries.map(
        entry => getTargetElement(entry)?.getBoundingClientRect().top
      );
      let current = entries[0]?.key ?? null;
      // Until the first section starts scrolling away, the reader is at the
      // start, however many short sections fit in the top of the viewport.
      const firstTop = tops[0];
      if (firstTop === undefined || firstTop < 0) {
        entries.forEach((entry, index) => {
          const top = tops[index];
          if (top !== undefined && top <= threshold) {
            current = entry.key;
          }
        });
      }
      setActiveKey(current);
    }
    function scheduleUpdate() {
      if (frame === null) {
        frame = window.requestAnimationFrame(update);
      }
    }
    function handleScroll() {
      const current = pick.current;
      if (current && !current.settled) {
        waitToSettle(current);
        return;
      }
      pick.current = null;
      scheduleUpdate();
    }

    scheduleUpdate();
    // Captured, so it hears the scroll of whichever element the page scrolls in.
    document.addEventListener('scroll', handleScroll, {capture: true, passive: true});
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      document.removeEventListener('scroll', handleScroll, {capture: true});
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [entries]);

  useEffect(() => () => window.clearTimeout(pick.current?.timeout), []);

  function pickEntry(key: string) {
    window.clearTimeout(pick.current?.timeout);
    const next = {settled: false, timeout: 0};
    waitToSettle(next);
    pick.current = next;
    setActiveKey(key);
  }

  return [activeKey, pickEntry] as const;
}

/**
 * Marks a pick settled once the page stops scrolling to it. Each scroll on the
 * way there restarts the wait.
 */
function waitToSettle(pick: {settled: boolean; timeout: number}) {
  window.clearTimeout(pick.timeout);
  pick.timeout = window.setTimeout(() => {
    pick.settled = true;
  }, SCROLL_SETTLE_MS);
}

/**
 * A rail listing the investigation's sections, which follows the reader down
 * the page and scrolls to the one they pick.
 */
export function InvestigationOutline({
  entries,
  investigationId,
}: {
  entries: InvestigationOutlineEntry[];
  investigationId: string;
}) {
  const organization = useOrganization();
  const [activeKey, pickEntry] = useActiveEntry(entries);
  const navRef = useRef<HTMLElement>(null);
  const shownFor = useRef<string | null>(null);

  // Narrow pages hide the rail, so it only counts as shown once it takes up
  // space. Reported once per investigation.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || shownFor.current === investigationId) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (nav.getBoundingClientRect().width === 0) {
        return;
      }
      observer.disconnect();
      shownFor.current = investigationId;
      trackAnalytics('seer.investigation.outline_shown', {
        organization,
        entry_count: entries.length,
        investigation_id: investigationId,
      });
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [entries.length, investigationId, organization]);

  return (
    <Stack
      ref={navRef}
      as="nav"
      aria-label={t('On this page')}
      gap="md"
      position="sticky"
      top={`calc(var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px) + ${OFFSET_BELOW_TOP_BAR}px)`}
      maxHeight={`calc(100vh - var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px) - ${OFFSET_BELOW_TOP_BAR * 2}px)`}
      overflowY="auto"
    >
      <Text bold>{t('On this page')}</Text>
      <OutlineList>
        {entries.map((entry, position) => (
          <li key={entry.key}>
            <OutlineEntryLink
              entry={entry}
              isActive={entry.key === activeKey}
              onPick={() => {
                pickEntry(entry.key);
                trackAnalytics('seer.investigation.outline_clicked', {
                  organization,
                  entry_count: entries.length,
                  investigation_id: investigationId,
                  kind: entry.kind,
                  position,
                });
              }}
            />
          </li>
        ))}
      </OutlineList>
    </Stack>
  );
}

function OutlineEntryLink({
  entry,
  isActive,
  onPick,
}: {
  entry: InvestigationOutlineEntry;
  isActive: boolean;
  onPick: () => void;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  return (
    <OutlineLink
      href={`#${getTargetId(entry)}`}
      aria-current={isActive ? 'location' : undefined}
      nested={entry.nested}
      // A label cut short shows in full on hover.
      title={isClamped ? entry.label : undefined}
      onPointerEnter={() => {
        const label = labelRef.current;
        setIsClamped(Boolean(label && label.scrollHeight > label.clientHeight));
      }}
      onClick={event => {
        event.preventDefault();
        const element = getTargetElement(entry);
        if (element) {
          onPick();
          scrollIntoViewBelowTopBar(element, OFFSET_BELOW_TOP_BAR);
        }
      }}
    >
      <OutlineLabel ref={labelRef} variant={isActive ? 'accent' : 'muted'}>
        {entry.label}
      </OutlineLabel>
    </OutlineLink>
  );
}

const OutlineList = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

/** Long headings stop at two lines. */
const OutlineLabel = styled(Text)`
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`;

const OutlineLink = styled('a')<{nested: boolean}>`
  display: block;
  /* Overlaps the list's border, so the current entry's marker stands in for it. */
  margin-left: -1px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  padding-left: ${p => (p.nested ? p.theme.space['2xl'] : p.theme.space.md)};
  border-left: 2px solid transparent;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[aria-current] {
    border-left-color: ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;
