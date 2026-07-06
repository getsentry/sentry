import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {isEAPSpan} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

/**
 * URL query param that holds the single pinned attribute key. The URL is the
 * source of truth so the pinned column is shareable and survives a reload.
 */
export const PINNED_ATTRIBUTE_QUERY_KEY = 'pinnedAttribute';

/**
 * Width (in px) of the pinned attribute column that sits between the trace tree
 * and the duration waterfall. Both the per-row cells and the header use this.
 */
export const PINNED_COLUMN_WIDTH = 160;

const EMPTY_VALUE = '—';

/**
 * Attributes that are always requested from the trace endpoint so the waterfall
 * can render things like http errors and gen_ai enrichment.
 */
export const DEFAULT_TRACE_ADDITIONAL_ATTRIBUTES = [
  'thread.id',
  'tags[performance.timeOrigin,number]',
  'gen_ai.operation.type',
  'http.response.status_code',
  'span.status',
];

/**
 * Scalar attributes the trace endpoint returns as native span fields, keyed by
 * the attribute name as it appears in the span details drawer — i.e. what a user
 * actually pins (`span.description`, NOT the backend column name `description`) —
 * and mapped to the corresponding field on the span value. Used both to keep
 * these out of the additional_attributes request and to read their value for the
 * pinned column. Mirrors `src/sentry/snuba/spans_rpc.py` `run_trace_query`.
 */
const NATIVE_ATTRIBUTE_FIELDS: Record<string, keyof TraceTree.EAPSpan> = {
  'span.op': 'op',
  'span.name': 'name',
  'span.description': 'description',
  'span.duration': 'duration',
  transaction: 'transaction',
  is_transaction: 'is_transaction',
  'sdk.name': 'sdk_name',
};

/**
 * Measurements, web vitals, and mobile vitals the trace endpoint always returns
 * (mirrors `src/sentry/snuba/spans_rpc.py`). Kept as an exact set — not a prefix
 * match — so that custom measurements not returned by the endpoint are still
 * requested. Drift only costs a redundant refetch or an empty cell, never a
 * crash.
 */
const TRACE_RESPONSE_MEASUREMENT_ATTRIBUTES = new Set<string>([
  'measurements.time_to_initial_display',
  'measurements.time_to_full_display',
  'measurements.app_start_cold',
  'measurements.app_start_warm',
  'measurements.frames_slow_rate',
  'measurements.frames_frozen_rate',
  'measurements.lcp',
  'measurements.score.ratio.lcp',
  'measurements.fcp',
  'measurements.score.ratio.fcp',
  'measurements.inp',
  'measurements.score.ratio.inp',
  'measurements.cls',
  'measurements.score.ratio.cls',
  'measurements.ttfb',
  'measurements.score.ratio.ttfb',
  'browser.web_vital.lcp.value',
  'browser.web_vital.cls.value',
  'browser.web_vital.inp.value',
  'browser.web_vital.ttfb.value',
  'browser.web_vital.fcp.value',
  'app.vitals.start.cold.value',
  'app.vitals.start.warm.value',
  'app.vitals.ttid.value',
  'app.vitals.ttfd.value',
]);

/**
 * Whether the trace endpoint already returns this attribute (as a native span
 * field or one of the always-requested default attributes). Pinning such an
 * attribute must NOT add it to the additional_attributes request.
 */
export function isTraceResponseAttribute(key: string): boolean {
  return (
    key in NATIVE_ATTRIBUTE_FIELDS ||
    TRACE_RESPONSE_MEASUREMENT_ATTRIBUTES.has(key) ||
    DEFAULT_TRACE_ADDITIONAL_ATTRIBUTES.includes(key)
  );
}

/**
 * Builds the additional_attributes request for the trace endpoint: the default
 * set plus the pinned attribute, unless the pinned attribute is already included
 * in the trace response. Sorted for a stable react-query key so toggling
 * unrelated state never triggers a refetch.
 */
export function getTraceAdditionalAttributes(pinnedAttribute: string | null): string[] {
  const attributes = new Set(DEFAULT_TRACE_ADDITIONAL_ATTRIBUTES);
  if (pinnedAttribute && !isTraceResponseAttribute(pinnedAttribute)) {
    attributes.add(pinnedAttribute);
  }
  return Array.from(attributes).sort();
}

/**
 * Resolves a pinned attribute's value for a node, checking the requested
 * additional attributes first and then falling back to the native span fields
 * the trace endpoint always returns (so attributes excluded from the request
 * still render).
 */
export function getPinnedAttributeValue(
  node: BaseNode,
  key: string
): string | number | boolean | undefined {
  const additionalValue = node.attributes?.[key];
  if (additionalValue !== undefined) {
    return additionalValue;
  }

  const value = node.value;
  if (!isEAPSpan(value)) {
    return undefined;
  }

  const nativeField = NATIVE_ATTRIBUTE_FIELDS[key];
  if (nativeField) {
    const nativeValue = value[nativeField];
    return typeof nativeValue === 'string' ||
      typeof nativeValue === 'number' ||
      typeof nativeValue === 'boolean'
      ? nativeValue
      : undefined;
  }
  if (key.startsWith('measurements.')) {
    return value.measurements?.[key];
  }
  if (key.startsWith('browser.web_vital.')) {
    return value.browser_web_vital?.[key];
  }
  if (key.startsWith('app.vitals.')) {
    return value.mobile_app_vital?.[key];
  }
  return undefined;
}

interface UseTracePinnedAttribute {
  pinnedAttribute: string | null;
  setPinnedAttribute: (attribute: string | null) => void;
}

/**
 * Reads and writes the pinned attribute from the URL. Uses `useLocation` (which
 * is reactive to navigation) rather than `useTraceQueryParams` (which memoizes
 * on mount and does not react to URL changes).
 */
export function useTracePinnedAttribute(): UseTracePinnedAttribute {
  const location = useLocation();
  const navigate = useNavigate();

  const pinnedAttribute =
    decodeScalar(location.query[PINNED_ATTRIBUTE_QUERY_KEY]) || null;

  const setPinnedAttribute = useCallback(
    (attribute: string | null) => {
      const query = {...location.query};
      if (attribute) {
        query[PINNED_ATTRIBUTE_QUERY_KEY] = attribute;
      } else {
        delete query[PINNED_ATTRIBUTE_QUERY_KEY];
      }
      navigate({pathname: location.pathname, query}, {replace: true});
    },
    [location.pathname, location.query, navigate]
  );

  return {pinnedAttribute, setPinnedAttribute};
}

/**
 * A single cell in the pinned attribute column, rendered once per waterfall row.
 * Reads the value straight off the node's loaded attributes. Renders a muted
 * placeholder when the span has no value for the pinned attribute.
 *
 * The value lives in an inner element that the view manager translates so the
 * whole column scrolls horizontally as one unit (mirroring the tree column).
 */
export function TracePinnedAttributeColumn({
  node,
  pinnedAttribute,
  manager,
}: {
  manager: VirtualizedViewManager;
  node: BaseNode;
  pinnedAttribute: string;
}) {
  const value = getPinnedAttributeValue(node, pinnedAttribute);
  const hasValue = value !== undefined && value !== null && value !== '';
  const displayValue = hasValue ? String(value) : EMPTY_VALUE;

  return (
    <div
      className="TracePinnedColumn"
      style={{width: PINNED_COLUMN_WIDTH}}
      ref={manager.registerPinnedColumnRef}
    >
      <div className="TracePinnedColumnInner">
        <span
          className={`TracePinnedColumnValue ${hasValue ? '' : 'Empty'}`}
          title={hasValue ? displayValue : undefined}
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
}

/**
 * The header cell for the pinned attribute column. Shows the prettified
 * attribute name and an unpin button. Rendered once, in the waterfall header.
 */
export function TracePinnedAttributeHeader({pinnedAttribute}: {pinnedAttribute: string}) {
  const {setPinnedAttribute} = useTracePinnedAttribute();
  const label = prettifyAttributeName(pinnedAttribute);

  return (
    <div className="TracePinnedColumnHeader" style={{width: PINNED_COLUMN_WIDTH}}>
      <Tooltip title={label} showOnlyOnOverflow>
        <span className="TracePinnedColumnHeaderLabel">{label}</span>
      </Tooltip>
      <Button
        size="zero"
        variant="transparent"
        icon={<IconClose size="xs" />}
        aria-label={t('Remove pinned column')}
        onClick={() => setPinnedAttribute(null)}
      />
    </div>
  );
}
