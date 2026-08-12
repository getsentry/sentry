import {useCallback, useMemo} from 'react';
import {Global, css} from '@emotion/react';

import {t} from 'sentry/locale';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/context';

export interface TelemetrySection {
  key: string;
  label: string;
}

/**
 * Friendly labels for the reorderable telemetry sections. Keys not listed here
 * fall back to a humanized version of the section key, so the control always
 * reflects whatever is actually registered on the page.
 */
const SECTION_LABELS: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: t('Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.CHAINED_EXCEPTION]: t('Stack Trace'),
  [SectionKey.THREADS]: t('Stack Trace'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TRACE]: t('Trace Preview'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.FEATURE_FLAGS]: t('Feature Flags'),
  [SectionKey.LOGS]: t('Logs'),
  [SectionKey.METRICS]: t('Application Metrics'),
  [SectionKey.REPLAY]: t('Session Replay'),
  [SectionKey.REQUEST]: t('HTTP Request'),
  [SectionKey.SDK]: t('SDK'),
  [SectionKey.GROUPING_INFO]: t('Event Grouping'),
  [SectionKey.DEBUGMETA]: t('Images Loaded'),
  [SectionKey.SCREENSHOT]: t('Screenshot'),
  [SectionKey.SPAN_EVIDENCE]: t('Span Evidence'),
  [SectionKey.EVIDENCE]: t('Evidence'),
  [SectionKey.MESSAGE]: t('Message'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.EXTRA]: t('Additional Data'),
  [SectionKey.DEVICE]: t('Device'),
  [SectionKey.PACKAGES]: t('Packages'),
  [SectionKey.VIEW_HIERARCHY]: t('View Hierarchy'),
  [SectionKey.ATTACHMENTS]: t('Attachments'),
  [SectionKey.HYDRATION_DIFF]: t('Hydration Diff'),
  [SectionKey.SPAN_ATTRIBUTES]: t('Span Attributes'),
  [SectionKey.PROGUARD]: t('ProGuard'),
  [SectionKey.PROCESSING_ERROR]: t('Processing Errors'),
};

/**
 * Sections that live in the sidebar / investigation surfaces rather than the
 * telemetry tab. They should never appear in the telemetry reorder control even
 * if they happen to be registered in the shared section context.
 */
const EXCLUDED_KEYS = new Set<string>([
  SectionKey.ACTIVITY,
  SectionKey.PEOPLE,
  SectionKey.SEER,
  SectionKey.EXTERNAL_ISSUES,
  SectionKey.MERGED_ISSUES,
  SectionKey.SIMILAR_ISSUES,
  SectionKey.RESOURCES,
  SectionKey.SUSPECT_ROOT_CAUSE,
]);

function humanizeKey(key: string) {
  return key
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * The telemetry sections actually present on the page, in registration order,
 * derived from the shared issue-details section context so the reorder control
 * always matches reality instead of a hard-coded list.
 */
function useAvailableSections(): TelemetrySection[] {
  const {sectionData} = useIssueDetails();
  return useMemo(
    () =>
      Object.keys(sectionData)
        .filter(key => !EXCLUDED_KEYS.has(key))
        .map(key => ({
          key,
          label: SECTION_LABELS[key as SectionKey] ?? humanizeKey(key),
        })),
    [sectionData]
  );
}

const STORAGE_KEY = 'issue-details-redesign:telemetry-section-prefs';

interface SectionPrefs {
  hidden: string[];
  order: string[];
}

const DEFAULT_PREFS: SectionPrefs = {order: [], hidden: []};

export interface TelemetrySectionPrefs {
  /**
   * Whether the user has explicitly reordered sections. Until they do, the
   * default content order is left completely untouched.
   */
  hasCustomOrder: boolean;
  hiddenKeys: Set<string>;
  orderedSections: TelemetrySection[];
  setOrder: (keys: string[]) => void;
  toggleHidden: (key: string) => void;
}

/**
 * Reads and writes the persisted telemetry-section preferences and reconciles
 * them with the sections actually present on the page. Backed by
 * `useSyncedLocalStorageState` so the control popover and the content wrapper
 * stay in sync even though they render in different parts of the tree.
 */
export function useTelemetrySectionPrefs(): TelemetrySectionPrefs {
  const available = useAvailableSections();
  const [prefs, setPrefs] = useSyncedLocalStorageState(STORAGE_KEY, DEFAULT_PREFS);

  const orderedSections = useMemo(() => {
    const byKey = new Map(available.map(section => [section.key, section]));
    const seen = new Set<string>();
    const ordered: TelemetrySection[] = [];
    // Persisted order first (dropping keys no longer present)...
    for (const key of prefs.order) {
      const section = byKey.get(key);
      if (section && !seen.has(key)) {
        ordered.push(section);
        seen.add(key);
      }
    }
    // ...then any sections that appeared since the preference was saved.
    for (const section of available) {
      if (!seen.has(section.key)) {
        ordered.push(section);
        seen.add(section.key);
      }
    }
    return ordered;
  }, [available, prefs.order]);

  const hiddenKeys = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  // `useSyncedLocalStorageState`'s setter takes a value (no functional update),
  // so we derive the next state from the current `prefs`.
  const setOrder = useCallback(
    (keys: string[]) => setPrefs({...prefs, order: keys}),
    [prefs, setPrefs]
  );

  const toggleHidden = useCallback(
    (key: string) => {
      const hidden = new Set(prefs.hidden);
      if (hidden.has(key)) {
        hidden.delete(key);
      } else {
        hidden.add(key);
      }
      setPrefs({...prefs, hidden: [...hidden]});
    },
    [prefs, setPrefs]
  );

  return {
    orderedSections,
    hiddenKeys,
    hasCustomOrder: prefs.order.length > 0,
    setOrder,
    toggleHidden,
  };
}

function escapeId(key: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key;
}

/**
 * Generates CSS rules that hide and reorder telemetry sections. Each
 * `FoldSection` renders `<section id={sectionKey}>` + `<hr>` as siblings.
 * Sections may be direct flex children of the container or wrapped in
 * `ErrorBoundary` divs — the rules handle both cases.
 *
 * - `display: none` hides sections + their adjacent `<hr>` divider (any depth).
 * - `order` on the section + `<hr>` handles direct-flex-child sections.
 * - `:has()` rule targets wrapper elements (ErrorBoundary divs) for nested
 *   sections; the container itself is excluded via `[data-telemetry-container]`.
 */
export function generateTelemetryCSS(
  orderedSections: TelemetrySection[],
  hiddenKeys: Set<string>,
  hasCustomOrder: boolean
): string {
  const rules: string[] = [];
  orderedSections.forEach((section, index) => {
    const id = escapeId(section.key);
    if (hiddenKeys.has(section.key)) {
      rules.push(`#${id}, #${id} + hr { display: none !important; }`);
    }
    if (hasCustomOrder) {
      rules.push(`#${id}, #${id} + hr { order: ${index}; }`);
      rules.push(`[data-telemetry-container] > :has(#${id}) { order: ${index}; }`);
    }
  });
  return rules.join('\n');
}

/**
 * Renders global CSS that hides/reorders telemetry sections based on user
 * preferences. Uses Emotion's `Global` so styles are injected into `<head>`
 * with proper CSP nonce handling. Eliminates the timing issues of imperative
 * DOM manipulation — styles apply reactively whenever prefs change.
 */
export function TelemetryLayoutStyles() {
  const {orderedSections, hiddenKeys, hasCustomOrder} = useTelemetrySectionPrefs();

  const styles = useMemo(() => {
    const raw = generateTelemetryCSS(orderedSections, hiddenKeys, hasCustomOrder);
    if (!raw) {
      return null;
    }
    return css`
      ${raw}
    `;
  }, [orderedSections, hiddenKeys, hasCustomOrder]);

  if (!styles) {
    return null;
  }
  return <Global styles={styles} />;
}
