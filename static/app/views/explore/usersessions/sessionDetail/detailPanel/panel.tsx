import type {LocationDescriptor} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';
import {ROW_CONFIG} from 'sentry/views/explore/usersessions/sessionDetail/rowConfig';
import {
  formatDurationMs,
  formatOffset,
} from 'sentry/views/explore/usersessions/sessionDetail/sessionTime';
import type {SeverityVariant} from 'sentry/views/explore/usersessions/sessionDetail/severity';
import {severityVariant} from 'sentry/views/explore/usersessions/sessionDetail/severity';
import {TelemetryTypeIcon} from 'sentry/views/explore/usersessions/sessionDetail/telemetryTypeIcon';
import type {
  SessionEvent,
  SessionRange,
} from 'sentry/views/explore/usersessions/sessionDetail/useSessionDetail';

import {ErrorDetail} from './errorDetail';
import {TraceDetail} from './traceDetail';
import {isTraceItemKey, TraceItemDetail} from './traceItemDetail';

const DATASET_BY_KEY = Object.fromEntries(
  SESSION_DATASETS.map(config => [config.key, config])
) as Record<SessionDatasetKey, (typeof SESSION_DATASETS)[number]>;

/** Where the item is owned in full, per kind. */
const OPEN_LABEL: Record<SessionDatasetKey, string> = {
  traces: t('Open Full Trace'),
  logs: t('Open in Logs'),
  metrics: t('Open in Trace'),
  errors: t('Open Issue'),
  feedback: t('Open Feedback'),
};

interface Props {
  bounds: SessionRange | undefined;
  dateParams: Record<string, any>;
  event: SessionEvent | undefined;
  /** True while the timeline is still loading, so a linked item is not yet known. */
  isPending: boolean;
}

/**
 * The selected timeline item, previewed in place.
 *
 * Everything above the divider is uniform across kinds — the same icon the rail
 * marks the row with, the same offset the rail measures it at — so clicking from a
 * log to a trace doesn't relayout the top of the panel. What differs is the body,
 * and the button that leads to the tool that owns the item in full.
 */
export function SessionItemDetailPanel({event, bounds, dateParams, isPending}: Props) {
  const organization = useOrganization();
  const location = useLocation();

  if (!event) {
    return (
      <DrawerBody>
        {/* A linked selection is resolved against the timeline, so until that has
            loaded there is no way to tell "not here yet" from "not here". */}
        {isPending ? (
          <Stack gap="md">
            <Placeholder height="16px" width="60%" />
            <Placeholder height="200px" />
          </Stack>
        ) : (
          <Text size="sm" variant="muted">
            {t('This item is no longer in the timeline.')}
          </Text>
        )}
      </DrawerBody>
    );
  }

  const rowId = event.row.id;
  // A trace row is addressed by its segment span, so the id worth copying is the
  // trace's — that is what identifies the thing the row names.
  const copyId = event.key === 'traces' ? event.row.trace : rowId;

  return (
    <Shell
      type={event.key}
      variant={severityVariant(event)}
      kind={DATASET_BY_KEY[event.key].singularLabel}
      title={event.title}
      detail={event.detail}
      timestamp={event.timestamp}
      duration={event.duration}
      copyId={typeof copyId === 'string' ? copyId : undefined}
      link={ROW_CONFIG[event.key].getLink(event.row, {
        organization,
        location,
        dateParams,
      })}
      bounds={bounds}
    >
      {event.key === 'traces' ? (
        // Two halves, in the order they answer "what is this": the trace itself,
        // then the attributes of the span that named it.
        <Stack gap="xl">
          <TraceDetail event={event} />
          <Separator orientation="horizontal" border="primary" />
          <TraceItemDetail event={event} itemKey="traces" />
        </Stack>
      ) : isTraceItemKey(event.key) ? (
        <TraceItemDetail event={event} itemKey={event.key} />
      ) : (
        <ErrorDetail event={event} />
      )}
    </Shell>
  );
}

/**
 * The frame every kind of item is shown in: what it is, when it happened, how to
 * get to it, and then the type-specific body.
 *
 * Attribute rows in those bodies offer copy and open-link but not "Add to filter":
 * those actions come from `useAttributeTreeSearchActions`, which needs the explore
 * query-params providers that this page doesn't have.
 */
function Shell({
  type,
  variant,
  kind,
  title,
  detail,
  timestamp,
  duration,
  copyId,
  link,
  bounds,
  children,
}: {
  bounds: SessionRange | undefined;
  children: React.ReactNode;
  kind: string;
  title: string;
  type: SessionDatasetKey;
  variant: SeverityVariant;
  copyId?: string;
  detail?: string;
  duration?: number;
  link?: LocationDescriptor;
  timestamp?: number;
}) {
  return (
    <Stack minHeight="0">
      <DrawerHeader hideCloseButtonText>
        <Flex align="center" gap="sm" minWidth="0" flex="1">
          <TelemetryTypeIcon type={type} size="sm" variant={variant} />
          {/*
            The type, said once in words beside the icon that says it in shape.
            Small and uppercase so it reads as a label on the title rather than as
            part of it — the same treatment the rail gives it.
          */}
          <Text size="xs" variant="muted" uppercase bold wrap="nowrap">
            {kind}
          </Text>
          <InfoText title={title} mode="overflowOnly" size="md" bold>
            {title}
          </InfoText>
        </Flex>
      </DrawerHeader>

      <DrawerBody>
        <Stack gap="xl" minWidth="0">
          <Flex align="center" gap="md" wrap="wrap">
            {timestamp !== undefined &&
              bounds !== undefined && (
                // Offset from the session start, the way the rail reads it, with the
                // wall clock one hover away.
                <InfoText
                  title={<DateTime date={timestamp} seconds timeZone />}
                  variant="muted"
                  size="sm"
                  tabular
                >
                  {formatOffset(timestamp - bounds.start)}
                </InfoText>
              )}
            {duration !== undefined && (
              <Text size="sm" variant="muted" tabular>
                {formatDurationMs(duration)}
              </Text>
            )}
            {detail && <Tag variant={variant}>{detail}</Tag>}
            <Flex flex="1" />
            {copyId && (
              <CopyToClipboardButton
                text={copyId}
                size="zero"
                variant="transparent"
                aria-label={t('Copy ID')}
              />
            )}
            {link && (
              <LinkButton size="xs" to={link}>
                {OPEN_LABEL[type]}
              </LinkButton>
            )}
          </Flex>

          <Separator orientation="horizontal" border="primary" />

          {children}
        </Stack>
      </DrawerBody>
    </Stack>
  );
}
