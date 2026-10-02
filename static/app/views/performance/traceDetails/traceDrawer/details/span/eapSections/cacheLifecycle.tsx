import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Timeline, type TimelineItemProps} from 'sentry/components/timeline';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import {
  useTraceItemDetails,
  type TraceItemResponseAttribute,
  type TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {useTraceStateDispatch} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

const CACHE_ORIGIN_LINK_TYPE = 'cache_origin';

type TimelineColorConfig = NonNullable<TimelineItemProps['colorConfig']>;

interface CacheLifecycleSectionProps {
  attributes: TraceItemResponseAttribute[];
  location: Location;
  node: EapSpanNode;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  links?: TraceItemResponseLink[];
  tree?: TraceTree;
}

/** Cache attributes shared by read (`cache.get`) and write (`cache.put`) spans. */
interface CacheSpanSummary {
  durationMs: number | undefined;
  hit: boolean | undefined;
  itemAgeSeconds: number | undefined;
  key: string | undefined;
  ttlSeconds: number | undefined;
}

function toFiniteNumber(value: number | bigint | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function getCacheSpanSummary(attributes: TraceItemResponseAttribute[]): CacheSpanSummary {
  return {
    hit: getAttributeValue(attributes, 'cache.hit', 'boolean'),
    itemAgeSeconds: toFiniteNumber(
      getAttributeValue(attributes, 'cache.item_age', 'number')
    ),
    ttlSeconds: toFiniteNumber(getAttributeValue(attributes, 'cache.ttl', 'number')),
    key:
      getAttributeValue(attributes, 'cache.key', 'string[]')?.[0] ??
      getAttributeValue(attributes, 'cache.key', 'string'),
    durationMs: toFiniteNumber(getAttributeValue(attributes, 'span.duration', 'number')),
  };
}

function getCacheOperation(
  node: EapSpanNode,
  attributes: TraceItemResponseAttribute[]
): 'get' | 'put' | undefined {
  const operation = getAttributeValue(attributes, 'cache.operation', 'string');
  if (operation === 'get' || node.op === 'cache.get') {
    return 'get';
  }
  if (operation === 'put' || node.op === 'cache.put') {
    return 'put';
  }
  return undefined;
}

/**
 * SDKs link a cache read to the `cache.put` span that filled the entry, with
 * link type `cache_origin`.
 *
 * TODO(cache): the backend drops typed link attributes, so the type check can
 * fail (fix: https://github.com/getsentry/sentry/pull/125749). Until that fix
 * covers the retention window, treat a single untyped link as the origin.
 */
function findCacheOriginLink(
  links: TraceItemResponseLink[] | undefined
): TraceItemResponseLink | undefined {
  if (!links?.length) {
    return undefined;
  }
  return (
    links.find(
      link =>
        getAttributeValue(link.attributes ?? [], 'sentry.link.type', 'string') ===
        CACHE_ORIGIN_LINK_TYPE
    ) ?? (links.length === 1 ? links[0] : undefined)
  );
}

/**
 * Link target and click handler for the origin span. The real href lets users
 * open the origin trace in a new tab. A plain left click is intercepted when
 * the fill span is in the tree already on screen: the replay trace view merges
 * several traces into one tree, so search it even when the link points to
 * another trace.
 */
function useOriginSpanLink({
  tree,
  node,
  link,
  itemAgeSeconds,
  organization,
  location,
  onTabScrollToNode,
}: Pick<
  CacheLifecycleSectionProps,
  'tree' | 'node' | 'organization' | 'location' | 'onTabScrollToNode'
> & {
  itemAgeSeconds: number | undefined;
  link: TraceItemResponseLink | undefined;
}) {
  const traceDispatch = useTraceStateDispatch();

  const to = link
    ? generateLinkToEventInTraceView({
        organization,
        location,
        traceSlug: link.traceId,
        spanId: link.itemId,
        // The origin trace started `cache.item_age` seconds before this read.
        timestamp: node.value.start_timestamp - (itemAgeSeconds ?? 0),
        tab: TraceLayoutTabKeys.WATERFALL,
      })
    : '';

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Modified clicks (new tab, new window) go through the href.
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    const spanNode = link
      ? tree?.root.findChild(c => c.matchById(link.itemId))
      : undefined;
    if (spanNode) {
      event.preventDefault();
      onTabScrollToNode(spanNode);
      return;
    }

    traceDispatch({type: 'minimize drawer', payload: true});
  }

  return {to, onClick};
}

function useTimelineColors() {
  const theme = useTheme();
  return {
    filled: {
      title: theme.tokens.content.accent,
      icon: theme.tokens.graphics.accent.vibrant,
      iconBorder: theme.tokens.border.transparent.accent.moderate,
    },
    hit: {
      title: theme.tokens.content.success,
      icon: theme.tokens.graphics.success.vibrant,
      iconBorder: theme.tokens.border.transparent.success.moderate,
    },
    miss: {
      title: theme.tokens.content.warning,
      icon: theme.tokens.graphics.warning.vibrant,
      iconBorder: theme.tokens.border.transparent.warning.moderate,
    },
    neutral: {
      title: theme.tokens.content.primary,
      icon: theme.tokens.graphics.neutral.vibrant,
      iconBorder: theme.tokens.border.transparent.neutral.moderate,
    },
  } satisfies Record<string, TimelineColorConfig>;
}

type TimelineColors = ReturnType<typeof useTimelineColors>;

/** Title and color of the "this span" row, from the three-state hit attribute. */
function getReadOutcome(
  hit: boolean | undefined,
  colors: TimelineColors
): {colorConfig: TimelineColorConfig; title: string} {
  if (hit === true) {
    return {title: t('Cache hit'), colorConfig: colors.hit};
  }
  if (hit === false) {
    return {title: t('Cache miss'), colorConfig: colors.miss};
  }
  return {title: t('Cache read'), colorConfig: colors.neutral};
}

function formatAge(seconds: number): string {
  return getDuration(seconds, seconds < 1 ? 2 : 0, true);
}

function formatMs(ms: number): string {
  return getDuration(ms / 1000, 2, true);
}

export function CacheLifecycleSection(props: CacheLifecycleSectionProps) {
  switch (getCacheOperation(props.node, props.attributes)) {
    case 'get':
      return <CacheReadLifecycleSection {...props} />;
    case 'put':
      return <CacheWriteLifecycleSection attributes={props.attributes} />;
    default:
      return null;
  }
}

function LifecycleFoldSection({
  tag,
  children,
}: {
  children: React.ReactNode;
  tag?: React.ReactNode;
}) {
  const title = (
    <TraceDrawerComponents.SectionTitleWithQuestionTooltip
      title={t('Cache Lifecycle')}
      tooltipText={t(
        'A cache-specific summary of this span’s attributes and links. Times are relative to this span.'
      )}
    />
  );

  return (
    <FoldSection
      sectionKey="cache-lifecycle"
      disableCollapsePersistence
      title={
        tag ? (
          <Flex gap="sm" align="center">
            {title}
            {tag}
          </Flex>
        ) : (
          title
        )
      }
    >
      <Timeline.Container>{children}</Timeline.Container>
    </FoldSection>
  );
}

/** Muted text for a timeline row's timestamp slot. */
function TimestampText({children}: {children: React.ReactNode}) {
  return (
    <Text size="sm" variant="muted">
      {children}
    </Text>
  );
}

/** The file that wrote the cache entry, truncated to one line. */
function SourceFileLine({path}: {path: string}) {
  return (
    <Text as="p" size="xs" variant="muted" ellipsis>
      {t('source')}{' '}
      <Text as="span" size="xs" variant="muted" monospace>
        {path}
      </Text>
    </Text>
  );
}

function ExpiresItem({
  inSeconds,
  ttlSeconds,
  colorConfig,
}: {
  colorConfig: TimelineColorConfig;
  inSeconds: number;
  ttlSeconds: number;
}) {
  return (
    <Timeline.Item
      title={t('Expires')}
      icon={<Timeline.Dot />}
      colorConfig={colorConfig}
      timestamp={<TimestampText>{t('%s later', formatAge(inSeconds))}</TimestampText>}
    >
      {t('ttl %s', formatAge(ttlSeconds))}
    </Timeline.Item>
  );
}

/**
 * Timeline of the entry a `cache.get` span read: filled, read (this span),
 * expires. Times are relative to this span.
 */
function CacheReadLifecycleSection(props: CacheLifecycleSectionProps) {
  const colors = useTimelineColors();
  const {
    hit,
    itemAgeSeconds,
    ttlSeconds,
    durationMs,
    key: cacheKey,
  } = getCacheSpanSummary(props.attributes);
  const link = findCacheOriginLink(props.links);

  // Fetch the linked fill span to show where the entry came from. The link
  // carries only a trace and a span id.
  // TODO(cache): backend needs:
  // - A project id on span links. Until then, assume the fill span is in the
  //   read span's project. This is wrong for caches shared across services.
  // - A registered referrer for this query (sentry/snuba/referrer.py). Until
  //   then, borrow the log-details referrer.
  const {data: originData, isLoading: isOriginLoading} = useTraceItemDetails({
    traceItemId: link?.itemId ?? '',
    projectId: props.node.value.project_id.toString(),
    traceId: link?.traceId ?? '',
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    // The fill happened `cache.item_age` seconds before this read.
    timestamp: props.node.value.start_timestamp - (itemAgeSeconds ?? 0),
    enabled: !!link,
  });

  const originAttributes = originData?.attributes ?? [];
  const origin = {
    isLoading: !!link && isOriginLoading,
    transactionName: getAttributeValue(originAttributes, 'transaction', 'string'),
    fillOperation: getAttributeValue(originAttributes, 'span.op', 'string'),
    fillDurationMs: toFiniteNumber(
      getAttributeValue(originAttributes, 'span.duration', 'number')
    ),
    sourceFilePath: getAttributeValue(originAttributes, 'code.file.path', 'string'),
  };

  const originSpanLink = useOriginSpanLink({...props, link, itemAgeSeconds});
  const outcome = getReadOutcome(hit, colors);

  const expiresInSeconds =
    itemAgeSeconds === undefined || ttlSeconds === undefined
      ? undefined
      : Math.max(ttlSeconds - itemAgeSeconds, 0);

  return (
    <LifecycleFoldSection
      tag={
        hit === undefined ? undefined : (
          <Tag variant={hit ? 'success' : 'warning'}>{hit ? t('Hit') : t('Miss')}</Tag>
        )
      }
    >
      {link || itemAgeSeconds !== undefined ? (
        <Timeline.Item
          title={t('Cache filled')}
          icon={<Timeline.Dot />}
          colorConfig={colors.filled}
          timestamp={
            itemAgeSeconds === undefined ? undefined : (
              <TimestampText>{t('%s earlier', formatAge(itemAgeSeconds))}</TimestampText>
            )
          }
        >
          <Stack gap="sm" align="start">
            <Stack gap="2xs" align="start">
              {origin.transactionName ? (
                <Text size="sm" bold>
                  {origin.transactionName}
                </Text>
              ) : null}
              {origin.sourceFilePath ? (
                <SourceFileLine path={origin.sourceFilePath} />
              ) : null}
              {origin.fillDurationMs === undefined ? null : (
                <Text size="xs" variant="muted">
                  {t(
                    '%s took %s',
                    origin.fillOperation ?? 'cache.put',
                    formatMs(origin.fillDurationMs)
                  )}
                </Text>
              )}
            </Stack>
            {link ? (
              <LinkButton
                size="xs"
                to={originSpanLink.to}
                onClick={originSpanLink.onClick}
              >
                {t('Open origin span')}
              </LinkButton>
            ) : null}
          </Stack>
        </Timeline.Item>
      ) : null}

      <Timeline.Item
        title={outcome.title}
        icon={<Timeline.Dot />}
        colorConfig={outcome.colorConfig}
        timestamp={<TimestampText>{t('this span')}</TimestampText>}
      >
        <Stack gap="2xs" align="start">
          <Flex gap="xs" align="center" wrap="wrap">
            {durationMs === undefined ? null : (
              <Text size="sm">{t('cache.get took %s', formatMs(durationMs))}</Text>
            )}
            {hit === false || itemAgeSeconds === undefined ? null : (
              <Text size="sm" variant="muted">
                {'·'} {t('age %s', formatAge(itemAgeSeconds))}
              </Text>
            )}
          </Flex>
          {hit === false ? (
            cacheKey ? (
              <Text size="sm" variant="muted">
                {t('no entry for key')}{' '}
                <Text as="span" size="sm" monospace>
                  {cacheKey}
                </Text>
              </Text>
            ) : (
              <Text size="sm" variant="muted">
                {t('the entry was not in the cache')}
              </Text>
            )
          ) : null}
        </Stack>
      </Timeline.Item>

      {expiresInSeconds !== undefined && ttlSeconds !== undefined && hit !== false ? (
        <ExpiresItem
          inSeconds={expiresInSeconds}
          ttlSeconds={ttlSeconds}
          colorConfig={colors.neutral}
        />
      ) : null}
    </LifecycleFoldSection>
  );
}

/**
 * Timeline of the entry a `cache.put` span wrote: filled (this span), expires
 * its ttl later. All data comes from this span's own attributes.
 */
function CacheWriteLifecycleSection({
  attributes,
}: {
  attributes: TraceItemResponseAttribute[];
}) {
  const colors = useTimelineColors();
  const {key: cacheKey, ttlSeconds, durationMs} = getCacheSpanSummary(attributes);
  const sourceFilePath = getAttributeValue(attributes, 'code.file.path', 'string');

  return (
    <LifecycleFoldSection>
      <Timeline.Item
        title={t('Cache filled')}
        icon={<Timeline.Dot />}
        colorConfig={colors.filled}
        timestamp={<TimestampText>{t('this span')}</TimestampText>}
      >
        <Stack gap="2xs" align="start">
          <Flex gap="xs" align="center" wrap="wrap">
            {durationMs === undefined ? null : (
              <Text size="sm">{t('cache.put took %s', formatMs(durationMs))}</Text>
            )}
            {cacheKey ? (
              <Text size="sm" variant="muted">
                {'·'} {t('key')}{' '}
                <Text as="span" size="sm" monospace>
                  {cacheKey}
                </Text>
              </Text>
            ) : null}
          </Flex>
          {sourceFilePath ? <SourceFileLine path={sourceFilePath} /> : null}
        </Stack>
      </Timeline.Item>

      {/*
        TODO(cache): add a "Served" row ("12 reads · 11 hits") between fill
        and expiry. Two ways to count the readers:
        - Today: cache.get spans with this cache.key in [start, start + ttl].
          Approximate under sampling.
        - Exact, once sentry.links is filterable
          (https://github.com/getsentry/sentry/pull/125741): cache.get spans
          whose links contain this span's id.

        <Timeline.Item
          title={t('Served')}
          icon={<Timeline.Dot />}
          colorConfig={colors.hit}
        >
          {t('%s reads · %s hits', readCount, hitCount)}
        </Timeline.Item>
      */}

      {ttlSeconds === undefined ? null : (
        <ExpiresItem
          inSeconds={ttlSeconds}
          ttlSeconds={ttlSeconds}
          colorConfig={colors.neutral}
        />
      )}
    </LifecycleFoldSection>
  );
}
