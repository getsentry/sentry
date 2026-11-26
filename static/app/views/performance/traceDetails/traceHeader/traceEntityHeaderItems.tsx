import {IconCalendar} from '@sentry/icons/calendar';
import {IconGlobe} from '@sentry/icons/globe';
import {IconPlay} from '@sentry/icons/play';
import {IconReleases} from '@sentry/icons/releases';
import {IconUser} from '@sentry/icons/user';
import {IconWindow} from '@sentry/icons/window';
import {PlatformIcon} from 'platformicons';

import {getDuration} from '@sentry/scraps/duration';
import type {
  EntityHeaderMetadataItemProps,
  EntityHeaderStatProps,
} from '@sentry/scraps/entityHeader';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {ReplayContextKey} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {getShortEventId} from 'sentry/utils/events';
import {FieldKey} from 'sentry/utils/fields';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import {unreachable} from 'sentry/utils/unreachable';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {TraceMetaQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceMeta';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/traceDetails/traceApi/utils';
import {getTraceIssuesTarget} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {TraceOverviewData} from 'sentry/views/performance/traceDetails/useTraceOverviewData';

type RootEvent = TraceRootEventQueryResults['data'];

type NameAndVersion = {name: string; version?: string};

/**
 * Most readable first, matching the conversations header: an IP address or ID
 * says less about who the user is than an email.
 */
const USER_FIELDS = ['user.email', 'user.username', 'user.ip', 'user.id'] as const;

type UserField = (typeof USER_FIELDS)[number];

const LEGACY_USER_KEYS = {
  'user.email': 'email',
  'user.username': 'username',
  'user.ip': 'ip_address',
  'user.id': 'id',
} as const satisfies Record<UserField, string>;

/**
 * Returns the value unless it is missing or whitespace-only, matching the rule
 * EntityHeader uses to decide whether a metadata value is drawable. The value
 * is returned untrimmed so it renders exactly as recorded.
 */
function present(value: string | null | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

function getUserFieldLabel(field: UserField): string {
  switch (field) {
    case 'user.email':
      return t('User email');
    case 'user.username':
      return t('User username');
    case 'user.ip':
      return t('User IP');
    case 'user.id':
      return t('User ID');
    default:
      return unreachable(field);
  }
}

function findUser(
  getValue: (field: UserField) => string | null | undefined
): TraceProperties['user'] {
  for (const field of USER_FIELDS) {
    const value = present(getValue(field));
    if (value) {
      return {field, value};
    }
  }
  return undefined;
}

/**
 * The root event's properties shown in the header, read from either an EAP
 * span's attributes or a legacy transaction's contexts and tags.
 */
export interface TraceProperties {
  browser?: NameAndVersion;
  environment?: string;
  os?: NameAndVersion;
  region?: string;
  release?: string;
  runtime?: NameAndVersion;
  /** The field the value came from, so it can be named. */
  user?: {field: UserField; value: string};
}

function getRepresentativeTitle(
  representativeEvent: TraceTree.RepresentativeTraceEvent | null
): {title: string; subtitle?: string} | null {
  const event = representativeEvent?.event;
  if (!event) {
    return null;
  }

  if (OurLogKnownFieldKey.SEVERITY in event) {
    return {title: t('Trace'), subtitle: event[OurLogKnownFieldKey.MESSAGE]};
  }

  return event.traceHeaderTitle ?? null;
}

/**
 * The most specific thing the trace is about, such as its root transaction or
 * log message, rendered as plain text. The broader title it replaces, such as
 * the root operation, is returned as `operation` unless it is the generic
 * "Trace".
 */
export function getTraceTitle(
  representativeEvent: TraceTree.RepresentativeTraceEvent | null
): {title: string; operation?: string} {
  const representativeTitle = getRepresentativeTitle(representativeEvent);
  const title = present(representativeTitle && stripAnsi(representativeTitle.title));
  const subtitle = present(
    representativeTitle?.subtitle && stripAnsi(representativeTitle.subtitle)
  );

  if (!subtitle) {
    return {title: title || t('Trace')};
  }

  return {title: subtitle, operation: title && title !== t('Trace') ? title : undefined};
}

export function getReplayId(rootEvent: RootEvent): string | undefined {
  if (!rootEvent) {
    return undefined;
  }

  const replayId = isTraceItemDetailsResponse(rootEvent)
    ? getAttributeValue(rootEvent.attributes, FieldKey.REPLAY_ID, 'string')
    : rootEvent.contexts.replay?.[ReplayContextKey.REPLAY_ID];

  return present(replayId);
}

function getAttributeProperties(
  rootEvent: TraceItemDetailsResponse,
  dataset: TraceItemDataset | null
): TraceProperties {
  // getAttributeValue stops at the first alias that exists, so drop blank
  // values to let a populated alias, such as `sentry.user.ip`, be found.
  const attributes = rootEvent.attributes.filter(
    ({value}) => typeof value !== 'string' || present(value)
  );
  const getString = (key: string) =>
    present(getAttributeValue(attributes, key, 'string'));

  // Resolve the name and version as a pair so a span that has only part of
  // each family can't report a version belonging to a different runtime.
  const isOtelRuntime = attributes.some(
    ({name}) => prettifyAttributeName(name) === 'process.runtime.name'
  );
  const runtimeNameKey = isOtelRuntime ? 'process.runtime.name' : 'runtime.name';
  const runtimeVersionKey = isOtelRuntime ? 'process.runtime.version' : 'runtime.version';
  const runtimeName = getString(runtimeNameKey);
  const runtimeVersion = present(
    getAttributeValue(
      attributes.filter(
        attribute => prettifyAttributeName(attribute.name) === runtimeVersionKey
      ),
      runtimeVersionKey,
      'string'
    )
  );

  const browserName = getString('browser.name');
  const osName = getString('os.name');

  return {
    runtime: runtimeName ? {name: runtimeName, version: runtimeVersion} : undefined,
    user: findUser(getString),
    browser: browserName
      ? {name: browserName, version: getString('browser.version')}
      : undefined,
    os: osName ? {name: osName, version: getString('os.version')} : undefined,
    release: getString('release'),
    // Uptime results store the checking region as a bare `region` attribute,
    // which on any other item is an arbitrary user attribute.
    region: dataset === TraceItemDataset.UPTIME_RESULTS ? getString('region') : undefined,
    environment: getString('environment'),
  };
}

function asNameAndVersion(context: unknown): NameAndVersion | undefined {
  if (!context || typeof context !== 'object') {
    return undefined;
  }
  const {name, version} = context as {name?: unknown; version?: unknown};
  if (typeof name !== 'string' || !present(name)) {
    return undefined;
  }
  return {name, version: typeof version === 'string' ? present(version) : undefined};
}

function getEventProperties(event: Event): TraceProperties {
  const contexts = event.contexts ?? {};
  const runtime = asNameAndVersion(contexts.runtime);
  let browser = asNameAndVersion(contexts.browser);

  // Events from the backend of a meta-framework (e.g. Next.js) also carry the
  // client's context, which doesn't describe this event.
  const isMetaFrameworkBackendEvent = 'client_os' in contexts && 'os' in contexts;
  if (isMetaFrameworkBackendEvent || (browser && browser.name === runtime?.name)) {
    browser = undefined;
  }

  const user = event.user;
  const getTag = (key: string) =>
    present(event.tags?.find(tag => tag.key === key)?.value);

  return {
    runtime,
    user: findUser(field => user?.[LEGACY_USER_KEYS[field]]),
    browser,
    os: asNameAndVersion(contexts.os),
    release: getTag('release'),
    environment: getTag('environment'),
  };
}

/**
 * `dataset` is the trace item type the root event was fetched as, which the
 * response itself doesn't carry.
 */
export function getTraceProperties(
  rootEvent: RootEvent,
  dataset: TraceItemDataset | null
): TraceProperties | null {
  if (!rootEvent) {
    return null;
  }

  return isTraceItemDetailsResponse(rootEvent)
    ? getAttributeProperties(rootEvent, dataset)
    : getEventProperties(rootEvent);
}

function platformGraphic({name, version}: NameAndVersion) {
  return <PlatformIcon platform={generatePlatformIconName(name, version)} size="16px" />;
}

function versionQualifier(version: string | undefined) {
  return version ? {label: t('version'), value: version} : undefined;
}

export function getTraceMetadataItems({
  operation,
  organization,
  project,
  properties,
  replayId,
  startTimestamp,
}: {
  operation: string | undefined;
  organization: Organization;
  project: AvatarProject | undefined;
  properties: TraceProperties | null;
  replayId: string | undefined;
  startTimestamp: number | undefined;
}): Array<EntityHeaderMetadataItemProps | null> {
  const {runtime, user, browser, os, release, region, environment} = properties ?? {};
  const formattedRelease = release ? formatVersion(release) : undefined;

  return [
    startTimestamp
      ? {
          type: 'date',
          label: t('Started'),
          date: new Date(startTimestamp),
          format: 'relative',
          leadingGraphic: <IconCalendar size="md" variant="muted" />,
        }
      : null,
    operation
      ? {type: 'text', label: t('Operation'), value: operation, mode: 'full'}
      : null,
    runtime
      ? {
          type: 'text',
          label: t('Runtime'),
          value: runtime.name,
          tooltip: t('Runtime'),
          secondary: versionQualifier(runtime.version),
          leadingGraphic: platformGraphic(runtime),
        }
      : null,
    user
      ? {
          type: 'text',
          label: getUserFieldLabel(user.field),
          value: user.value,
          tooltip: getUserFieldLabel(user.field),
          leadingGraphic: <IconUser size="md" variant="muted" />,
        }
      : null,
    browser
      ? {
          type: 'text',
          label: t('Browser'),
          value: browser.name,
          secondary: versionQualifier(browser.version),
          leadingGraphic: platformGraphic(browser),
        }
      : null,
    os
      ? {
          type: 'text',
          label: t('Operating system'),
          value: os.name,
          tooltip: t('Operating system'),
          secondary: versionQualifier(os.version),
          leadingGraphic: platformGraphic(os),
        }
      : null,
    release && formattedRelease
      ? {
          type: 'link',
          label: t('Release'),
          value: formattedRelease,
          tooltip: t('Release'),
          to: {
            pathname: makeReleasesPathname({
              organization,
              path: `/${encodeURIComponent(release)}/`,
            }),
            query: project?.id ? {project: project.id} : undefined,
          },
          leadingGraphic: <IconReleases size="md" variant="muted" />,
        }
      : null,
    environment
      ? {
          type: 'text',
          label: t('Environment'),
          value: environment,
          tooltip: t('Environment'),
          leadingGraphic: <IconWindow size="md" variant="muted" />,
        }
      : null,
    replayId
      ? {
          type: 'link',
          label: t('Replay'),
          value: getShortEventId(replayId),
          tooltip: t('Replay'),
          to: makeReplaysPathname({path: `/${replayId}/`, organization}),
          leadingGraphic: <IconPlay size="md" variant="muted" />,
        }
      : null,
    region
      ? {
          type: 'text',
          label: t('Uptime check region'),
          value: t('Check from %s', region),
          tooltip: t('Uptime check region'),
          leadingGraphic: <IconGlobe size="md" variant="muted" />,
        }
      : null,
  ];
}

function getSpansCounts(tree: TraceTree, meta: TraceMetaQueryResults['data']) {
  const traceNode = tree.root.children[0];
  const metaSpansCount = meta?.spansCount;

  if (traceNode && metaSpansCount && tree.eap_spans_count !== metaSpansCount) {
    return {count: metaSpansCount, loaded: tree.eap_spans_count, total: metaSpansCount};
  }
  if (traceNode) {
    return {count: tree.eap_spans_count, loaded: 0, total: 0};
  }
  return {count: metaSpansCount ?? 0, loaded: 0, total: 0};
}

function getRootDuration(
  representativeEvent: TraceTree.RepresentativeTraceEvent | null
): string | null {
  const event = representativeEvent?.event;
  // Logs don't have a duration.
  if (!event || OurLogKnownFieldKey.PROJECT_ID in event) {
    return null;
  }

  const {startTimestamp, endTimestamp} = event;
  if (!startTimestamp || !endTimestamp) {
    return null;
  }

  return getDuration(endTimestamp - startTimestamp, {precision: 2, style: 'short'});
}

export function getTraceStatItems({
  logsEnabled,
  meta,
  metricsEnabled,
  organization,
  overview,
  representativeEvent,
  traceSlug,
  tree,
}: {
  logsEnabled: boolean;
  meta: TraceMetaQueryResults['data'];
  metricsEnabled: boolean;
  organization: Organization;
  overview: TraceOverviewData;
  representativeEvent: TraceTree.RepresentativeTraceEvent | null;
  traceSlug: string;
  tree: TraceTree;
}): Array<EntityHeaderStatProps | null> {
  const traceNode = tree.root.children[0];
  const spans = getSpansCounts(tree, meta);
  const hasSpans = spans.count > 0 || spans.loaded > 0 || spans.total > 0;

  const logsCount = meta?.logsCount ?? overview.logs.count ?? 0;
  const logsLoading = logsEnabled && overview.logs.availability === 'loading';
  const hasLogs = logsEnabled && logsCount > 0;

  const metricsCount = meta?.metricsCount ?? overview.metrics.count ?? 0;
  const metricsLoading = metricsEnabled && overview.metrics.availability === 'loading';
  const hasMetrics = metricsEnabled && metricsCount > 0;

  const issuesCount = traceNode ? traceNode.uniqueIssues.length : 0;

  return [
    hasSpans
      ? {label: t('Root Duration'), value: getRootDuration(representativeEvent)}
      : null,
    hasSpans
      ? {
          label: t('Spans'),
          value:
            spans.loaded > 0 && spans.total > 0
              ? {
                  type: 'text',
                  content: spans.count,
                  tooltip: t('Showing %s of %s spans', spans.loaded, spans.total),
                }
              : spans.count,
        }
      : null,
    hasLogs || logsLoading
      ? {label: t('Logs'), value: logsCount, isLoading: !hasLogs}
      : null,
    hasMetrics || metricsLoading
      ? {label: t('Metrics'), value: metricsCount, isLoading: !hasMetrics}
      : null,
    {
      label: t('Issues'),
      value:
        traceNode && issuesCount > 0
          ? {
              type: 'link',
              content: issuesCount,
              to: getTraceIssuesTarget({node: traceNode, organization, traceSlug}),
            }
          : issuesCount,
    },
  ];
}
