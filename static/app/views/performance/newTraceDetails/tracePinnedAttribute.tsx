import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

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
 */
export function TracePinnedAttributeColumn({
  node,
  pinnedAttribute,
}: {
  node: BaseNode;
  pinnedAttribute: string;
}) {
  const value = node.attributes?.[pinnedAttribute];
  const hasValue = value !== undefined && value !== null && value !== '';
  const displayValue = hasValue ? String(value) : EMPTY_VALUE;

  return (
    <div className="TracePinnedColumn" style={{width: PINNED_COLUMN_WIDTH}}>
      <span
        className={`TracePinnedColumnValue ${hasValue ? '' : 'Empty'}`}
        title={hasValue ? displayValue : undefined}
      >
        {displayValue}
      </span>
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
