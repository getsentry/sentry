import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {Placeholder} from 'sentry/components/placeholder';
import {Timeline, type TimelineItemProps} from 'sentry/components/timeline';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {
  useTraceItemDetails,
  type TraceItemResponseAttribute,
  type TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {getSpanLinkType} from 'sentry/views/performance/traceDetails/getSpanLinkType';
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
    links.find(link => getSpanLinkType(link) === CACHE_ORIGIN_LINK_TYPE) ??
    (links.length === 1 ? links[0] : undefined)
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
  link,
  timestamp,
  organization,
  location,
  onTabScrollToNode,
}: Pick<
  CacheLifecycleSectionProps,
  'tree' | 'organization' | 'location' | 'onTabScrollToNode'
> & {
  link: TraceItemResponseLink;
  timestamp: number;
}) {
  const traceDispatch = useTraceStateDispatch();

  const to = generateLinkToEventInTraceView({
    organization,
    location,
    traceSlug: link.traceId,
    spanId: link.itemId,
    timestamp,
    tab: TraceLayoutTabKeys.WATERFALL,
  });

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Modified clicks (new tab, new window) go through the href.
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    const spanNode = tree?.root.findChild(c => c.matchById(link.itemId));
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
    // A future event, so it is quieter than the events that happened.
    projected: {
      title: theme.tokens.content.secondary,
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

/** `cache.item_age` and `cache.ttl` are whole seconds, so 0 means under a second. */
function formatAge(seconds: number): string {
  return seconds < 1 ? t('<1s') : getDuration(seconds, 0, true);
}

function formatMs(ms: number): string {
  return getDuration(ms / 1000, 2, true);
}

export function CacheLifecycleSection(props: CacheLifecycleSectionProps) {
  switch (getCacheOperation(props.node, props.attributes)) {
    case 'get':
      return <CacheReadLifecycleSection {...props} />;
    case 'put':
      return (
        <CacheWriteLifecycleSection
          attributes={props.attributes}
          spanStartTimestamp={props.node.value.start_timestamp}
        />
      );
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

/**
 * Muted text for a timeline row's time, with the absolute time on hover. Trace
 * times come from the SDK host clock, so do not compare them with the browser
 * clock.
 */
function TimestampText({
  timestamp,
  children,
}: {
  children: React.ReactNode;
  /** Unix time in seconds. */
  timestamp: number;
}) {
  return (
    <InfoText
      size="sm"
      variant="muted"
      title={<DateTime date={timestamp * 1000} seconds timeZone />}
    >
      {children}
    </InfoText>
  );
}

/**
 * Label-value pairs of a timeline row: muted labels, primary values. The
 * minimum label width keeps the values of all rows in one column.
 */
function LabelValueFacts({children}: {children: React.ReactNode}) {
  return (
    <Grid columns="minmax(56px, max-content) minmax(0, 1fr)" gap="sm md" align="baseline">
      {children}
    </Grid>
  );
}

function Fact({
  label,
  monospace,
  wrap,
  children,
}: {
  children: React.ReactNode;
  label: string;
  monospace?: boolean;
  /** Wrap long values instead of truncating them. */
  wrap?: boolean;
}) {
  return (
    <Fragment>
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text
        size="sm"
        monospace={monospace}
        {...(wrap ? {wordBreak: 'break-word'} : {ellipsis: true})}
      >
        {children}
      </Text>
    </Fragment>
  );
}

/**
 * The file of the cached function. The end of the path is its most specific
 * part, so wrap the path instead of truncating it, and break lines after `/`.
 */
function SourceFact({path}: {path: string}) {
  return (
    <Fact label={t('Source')} monospace wrap>
      {path.split('/').map((segment, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <Fragment>
              /<wbr />
            </Fragment>
          ) : null}
          {segment}
        </Fragment>
      ))}
    </Fact>
  );
}

/**
 * The end of an entry's TTL, which starts at the fill. Without `cache.ttl`
 * there is no expiry to show. The conventions list when SDKs omit it:
 * https://getsentry.github.io/sentry-conventions/attributes/cache/#cache-ttl
 */
interface CacheExpiry {
  /** Seconds between this span and the expiry. */
  distanceSeconds: number;
  state: 'upcoming' | 'expired';
  /** Unix time in seconds. */
  timestamp: number;
  ttlSeconds: number;
}

function getExpiry(
  spanStartTimestamp: number,
  ageSeconds: number,
  ttlSeconds: number
): CacheExpiry {
  // An entry is fresh only while its age is below its TTL.
  const remainingSeconds = ttlSeconds - ageSeconds;
  return {
    state: remainingSeconds > 0 ? 'upcoming' : 'expired',
    distanceSeconds: Math.abs(remainingSeconds),
    timestamp: spanStartTimestamp + remainingSeconds,
    ttlSeconds,
  };
}

function ExpiryItem({expiry, colors}: {colors: TimelineColors; expiry: CacheExpiry}) {
  const isExpired = expiry.state === 'expired';
  const distance = formatAge(expiry.distanceSeconds);

  return (
    <Timeline.Item
      title={isExpired ? t('Expired') : t('Expires')}
      icon={<Timeline.Dot />}
      colorConfig={isExpired ? colors.miss : colors.projected}
      timestamp={
        <TimestampText timestamp={expiry.timestamp}>
          {isExpired ? t('%s earlier', distance) : t('%s later', distance)}
        </TimestampText>
      }
    >
      <LabelValueFacts>
        <Fact label={t('TTL')}>
          {/* A TTL of 0 means the entry expires immediately. */}
          {expiry.ttlSeconds === 0
            ? t('0s, expires at fill')
            : t('%s after fill', formatAge(expiry.ttlSeconds))}
        </Fact>
      </LabelValueFacts>
    </Timeline.Item>
  );
}

/**
 * Body of the "Cache filled" row for a read that links to its fill span. The
 * link carries only a trace and a span id, so fetch the span for its details.
 *
 * TODO(cache): the backend needs a project id on span links. Until then,
 * assume the fill span is in the read span's project. This is wrong for
 * caches shared across services.
 */
function CacheOriginContent({
  link,
  itemAgeSeconds,
  ...props
}: CacheLifecycleSectionProps & {
  itemAgeSeconds: number | undefined;
  link: TraceItemResponseLink;
}) {
  // The fill happened `cache.item_age` seconds before this read.
  const fillTimestamp = props.node.value.start_timestamp - (itemAgeSeconds ?? 0);
  const isSampled = link.sampled ?? true;
  // The queryable span window of the plan. Older spans are deleted, so a request for them can only return a 404.
  const {maxPickableDays: retentionDays} = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const [nowMs] = useState(Date.now);
  const isPastRetention = fillTimestamp < nowMs / 1000 - retentionDays * 24 * 60 * 60;
  const {data, error, isLoading} = useTraceItemDetails({
    traceItemId: link.itemId,
    projectId: props.node.value.project_id.toString(),
    traceId: link.traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.trace-view.cache-origin',
    timestamp: fillTimestamp,
    enabled: isSampled && !isPastRetention,
  });
  const originSpanLink = useOriginSpanLink({
    ...props,
    link,
    timestamp: fillTimestamp,
  });

  if (!isSampled) {
    // The origin trace does not exist, so the existing link is a dead end
    return (
      <Text size="sm" variant="muted">
        {t(
          'The trace that filled this cache entry was not sampled, so it is not available'
        )}
      </Text>
    );
  }
  if (isPastRetention) {
    return (
      <Text size="sm" variant="muted">
        {t('Origin trace is older than your %s-day span retention', retentionDays)}
      </Text>
    );
  }

  const attributes = data?.attributes ?? [];
  const transactionName = getAttributeValue(attributes, 'transaction', 'string');
  const sourceFilePath = getAttributeValue(attributes, 'code.file.path', 'string');
  const fillDurationMs = toFiniteNumber(
    getAttributeValue(attributes, 'span.duration', 'number')
  );

  return (
    <Stack gap="md" align="start">
      {isLoading ? (
        // Placeholder skeleton so LinkButton does not jump too much when the data arrives.
        <Stack gap="2xs" align="start">
          <Placeholder width="160px" height="14px" />
          <Placeholder width="100px" height="12px" />
        </Stack>
      ) : (
        <Stack gap="2xs" align="start" width="100%">
          {error ? (
            <Text size="sm" variant="muted">
              {t('Span preview unavailable')}
            </Text>
          ) : null}
          <LabelValueFacts>
            {transactionName ? (
              <Fact label={t('Filled by')}>{transactionName}</Fact>
            ) : null}
            {sourceFilePath ? <SourceFact path={sourceFilePath} /> : null}
            {fillDurationMs === undefined ? null : (
              <Fact label={t('Write')}>{formatMs(fillDurationMs)}</Fact>
            )}
          </LabelValueFacts>
        </Stack>
      )}
      <LinkButton size="xs" to={originSpanLink.to} onClick={originSpanLink.onClick}>
        {t('Open origin span')}
      </LinkButton>
    </Stack>
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
  const outcome = getReadOutcome(hit, colors);
  const spanStartTimestamp = props.node.value.start_timestamp;
  const expiry =
    itemAgeSeconds === undefined || ttlSeconds === undefined
      ? undefined
      : getExpiry(spanStartTimestamp, itemAgeSeconds, ttlSeconds);

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
              <TimestampText timestamp={spanStartTimestamp - itemAgeSeconds}>
                {t('%s earlier', formatAge(itemAgeSeconds))}
              </TimestampText>
            )
          }
        >
          {link ? (
            <CacheOriginContent {...props} link={link} itemAgeSeconds={itemAgeSeconds} />
          ) : null}
        </Timeline.Item>
      ) : null}

      {/* Rows are in time order, so an expiry before this read comes first. */}
      {expiry?.state === 'expired' ? (
        <ExpiryItem expiry={expiry} colors={colors} />
      ) : null}

      <Timeline.Item
        title={outcome.title}
        icon={<Timeline.Dot />}
        colorConfig={outcome.colorConfig}
        timestamp={
          <TimestampText timestamp={spanStartTimestamp}>{t('this span')}</TimestampText>
        }
        isActive
        aria-current="step"
      >
        <LabelValueFacts>
          {durationMs === undefined ? null : (
            <Fact label={t('Read')}>{formatMs(durationMs)}</Fact>
          )}
          {hit === false && cacheKey ? (
            <Fact label={t('Key')} monospace>
              {cacheKey}
            </Fact>
          ) : null}
        </LabelValueFacts>
      </Timeline.Item>

      {/* A miss read no live entry, so it has no upcoming expiry. */}
      {expiry?.state === 'upcoming' && hit !== false ? (
        <ExpiryItem expiry={expiry} colors={colors} />
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
  spanStartTimestamp,
}: {
  attributes: TraceItemResponseAttribute[];
  spanStartTimestamp: number;
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
        timestamp={
          <TimestampText timestamp={spanStartTimestamp}>{t('this span')}</TimestampText>
        }
        isActive
        aria-current="step"
      >
        <LabelValueFacts>
          {durationMs === undefined ? null : (
            <Fact label={t('Write')}>{formatMs(durationMs)}</Fact>
          )}
          {cacheKey ? (
            <Fact label={t('Key')} monospace>
              {cacheKey}
            </Fact>
          ) : null}
          {sourceFilePath ? <SourceFact path={sourceFilePath} /> : null}
        </LabelValueFacts>
      </Timeline.Item>

      {/*
        TODO(cache): add a "Served" row ("12 reads · 11 hits") between fill
        and expiry. Two ways to count the readers:
        - By key: cache.get spans with this cache.key in [start, start + ttl].
          Also counts reads of other fills of the same key.
        - By link: `span.op:cache.get sentry.links:*<this span id>*` (#125741).
          Misses hits without a link. Match only the span id: the JSON is private.

        <Timeline.Item
          title={t('Served')}
          icon={<Timeline.Dot />}
          colorConfig={colors.hit}
        >
          {t('%s reads · %s hits', readCount, hitCount)}
        </Timeline.Item>
      */}

      {ttlSeconds === undefined ? null : (
        <ExpiryItem
          expiry={getExpiry(spanStartTimestamp, 0, ttlSeconds)}
          colors={colors}
        />
      )}
    </LifecycleFoldSection>
  );
}
