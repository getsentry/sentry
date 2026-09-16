import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconCopy, IconPin, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import {formatDollars} from 'sentry/utils/formatters';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getTraceQueryParams} from './traceApi/useTrace';
import type {TraceTree} from './traceModels/traceTree';
import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {isParentAutogroupedNode, isSiblingAutogroupedNode} from './traceGuards';
import {
  getPinnedAttributeValue,
  MULTIPLE_PINNED_VALUES,
  type PinnedAttributeValue,
} from './tracePinnedAttributeValues';

export const TRACE_ATTRIBUTE_PINNING_FEATURE = 'trace-waterfall-attribute-pinning';
export const PINNED_ATTRIBUTE_PARAM = 'pinnedAttribute';

type PinnedAttributeState = {
  attribute: string | null;
  enabled: boolean;
  isError: boolean;
  isPending: boolean;
  retry: () => void;
  setAttribute: (attribute: string | null) => void;
  values: ReadonlyMap<string, PinnedAttributeValue>;
};

export const TracePinnedAttributeContext = createContext<PinnedAttributeState | null>(
  null
);
export const usePinnedAttribute = () => useContext(TracePinnedAttributeContext);

export function useTracePinnedAttribute({
  enabled,
  isLoading,
  traceSlug,
  tree,
  manager,
}: {
  enabled: boolean;
  isLoading: boolean;
  manager: VirtualizedViewManager;
  traceSlug: string;
  tree: TraceTree;
}): PinnedAttributeState {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const queryAttribute = location.query[PINNED_ATTRIBUTE_PARAM];
  const attribute =
    enabled && typeof queryAttribute === 'string' && queryAttribute.length > 0
      ? queryAttribute
      : null;
  const visibleAttribute = !isLoading && tree.type === 'trace' ? attribute : null;
  const setAttribute = useCallback(
    (next: string | null) => {
      if (!enabled) {
        return;
      }
      const query = {...location.query};
      if (next) {
        query[PINNED_ATTRIBUTE_PARAM] = next;
      } else {
        delete query[PINNED_ATTRIBUTE_PARAM];
      }
      navigate({...location, query}, {replace: true});
    },
    [enabled, location, navigate]
  );

  // Anchor the lookup to the loaded trace, including when the initial trace request
  // found it by widening the date range. Attribute requests never replace the tree.
  const query = useQuery({
    ...apiOptions.as<TraceTree.EAPTrace>()(
      '/organizations/$organizationIdOrSlug/trace/$traceId/',
      {
        path:
          attribute && tree.type === 'trace'
            ? {organizationIdOrSlug: organization.slug, traceId: traceSlug}
            : skipToken,
        query: {
          ...getTraceQueryParams('eap', location.query, selection, {
            timestamp: tree.root.space[0] / 1000,
            limit: 10_000,
          }),
          project: -1,
          additional_attributes: attribute ? [attribute] : [],
          referrer: 'trace.waterfall.attribute-pinning',
        },
        staleTime: Infinity,
      }
    ),
    retry: false,
  });
  const values = useMemo(() => {
    const result = new Map<string, PinnedAttributeValue>();
    const pending = [...(query.data ?? [])];
    for (const item of pending) {
      if ('children' in item) {
        pending.push(...item.children);
      }
      if (item.event_type !== 'span') {
        continue;
      }
      const value: unknown = attribute ? item.additional_attributes?.[attribute] : null;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result.set(item.event_id, value);
      }
    }
    return result;
  }, [attribute, query.data]);

  useLayoutEffect(() => {
    manager.setAttributePinningEnabled(enabled);
  }, [enabled, manager]);

  useLayoutEffect(() => {
    manager.setPinnedColumnEnabled(visibleAttribute !== null);
  }, [visibleAttribute, manager]);

  return {
    enabled,
    attribute: visibleAttribute,
    setAttribute,
    values,
    isPending: query.isPending,
    isError: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}

export function TracePinnedAttributeHeader() {
  const pin = usePinnedAttribute();
  if (!pin?.attribute) {
    return null;
  }
  return (
    <Flex
      className="TracePinnedAttributeHeader"
      align="center"
      gap="xs"
      padding="xs md"
      borderBottom="primary"
      overflow="hidden"
    >
      <Text bold ellipsis size="sm" title={pin.attribute}>
        {pin.isError ? t('Could not load attribute') : pin.attribute}
      </Text>
      {pin.isError && (
        <Button
          size="zero"
          variant="transparent"
          aria-label={t('Retry loading attribute')}
          icon={<IconRefresh size="xs" />}
          onClick={pin.retry}
        />
      )}
      <Button
        size="zero"
        variant="transparent"
        aria-label={t('Unpin attribute')}
        icon={<IconPin size="xs" isSolid />}
        onClick={() => pin.setAttribute(null)}
      />
    </Flex>
  );
}

function formatPinnedValue(attribute: string, value: PinnedAttributeValue): string {
  if (value === null) {
    return '—';
  }
  if (typeof value === 'number') {
    if (['span.duration', 'span.total_time', 'duration'].includes(attribute)) {
      return formatTraceDuration(value);
    }
    if (attribute.startsWith('gen_ai.cost.')) {
      return formatDollars(value);
    }
  }
  return String(value);
}

export function TracePinnedAttributeCell({node}: {node: BaseNode}) {
  const pin = usePinnedAttribute();
  const {copy} = useCopyToClipboard();
  if (!pin?.attribute) {
    return null;
  }
  const value = getPinnedAttributeValue(node, pin.values);
  const isAutogrouped = isParentAutogroupedNode(node) || isSiblingAutogroupedNode(node);
  const label = pin.isError
    ? '—'
    : value === MULTIPLE_PINNED_VALUES
      ? t('Multiple values')
      : formatPinnedValue(pin.attribute, value);
  const canCopy =
    !pin.isPending && !pin.isError && value !== null && value !== MULTIPLE_PINNED_VALUES;
  return (
    <RevealOnHover>
      {hoverProps => (
        <Flex
          {...hoverProps}
          className={`${hoverProps.className} TracePinnedAttributeCell`}
          align="center"
          position="relative"
          paddingLeft="md"
          paddingRight="xs"
          overflow="hidden"
          height="100%"
        >
          {pin.isPending && !isAutogrouped ? (
            <LoadingIndicator size={12} style={{margin: 0}} />
          ) : (
            <Text ellipsis size="sm">
              {label}
            </Text>
          )}
          {canCopy && (
            <RevealOnHover.Action>
              <Flex
                position="absolute"
                right="4px"
                top="0"
                bottom="0"
                align="center"
                padding="0 2xs"
                background="primary"
              >
                <Button
                  size="zero"
                  variant="transparent"
                  aria-label={t('Copy attribute value')}
                  icon={<IconCopy size="xs" />}
                  onPointerDown={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    copy(String(value));
                  }}
                />
              </Flex>
            </RevealOnHover.Action>
          )}
        </Flex>
      )}
    </RevealOnHover>
  );
}

export function TraceAttributeDivider({
  edge,
  manager,
}: {
  edge: 'left' | 'right';
  manager: VirtualizedViewManager;
}) {
  const previousX = useRef<number | null>(null);
  return (
    <Flex
      role="separator"
      aria-label={
        edge === 'left'
          ? t('Resize tree and attribute columns')
          : t('Resize attribute and timeline columns')
      }
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(
        100 *
          (manager.columns.list.width +
            (edge === 'right' ? manager.columns.attribute.width : 0))
      )}
      tabIndex={0}
      className={`TraceDivider TraceAttributeDivider ${edge}`}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
          return;
        }
        event.preventDefault();
        manager.resizePinnedColumn(
          edge,
          (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 50 : 10)
        );
        manager.finishPinnedColumnResize();
      }}
      onPointerDown={event => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        previousX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          manager.resizePinnedColumn(
            edge,
            event.clientX - (previousX.current ?? event.clientX)
          );
          previousX.current = event.clientX;
        }
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onLostPointerCapture={() => {
        previousX.current = null;
        manager.finishPinnedColumnResize();
      }}
    />
  );
}
