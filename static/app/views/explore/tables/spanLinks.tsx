import type {Location} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconLink} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {TraceViewSources} from 'sentry/views/performance/traceDetails/traceHeader/breadcrumbs';

const LINK_TYPE_ATTRIBUTE = 'sentry.link.type';

/**
 * One entry of the `sentry.links` span attribute. The attribute holds a JSON
 * array of these, written by the span ingestion pipeline.
 */
export interface SpanLink {
  span_id: string;
  trace_id: string;
  attributes?: Record<string, unknown>;
  sampled?: boolean;
}

/**
 * Parses the raw `sentry.links` cell value. Returns null when the value is
 * empty or is not a JSON array of span links, so callers can fall back to the
 * plain string renderer.
 */
export function parseSpanLinks(value: unknown): SpanLink[] | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || !parsed.every(isSpanLink)) {
    return null;
  }

  return parsed;
}

function isSpanLink(link: unknown): link is SpanLink {
  if (typeof link !== 'object' || link === null) {
    return false;
  }
  const candidate = link as Partial<SpanLink>;
  return typeof candidate.span_id === 'string' && typeof candidate.trace_id === 'string';
}

/**
 * Link attributes arrive either as plain scalars or as typed
 * `{type, value}` objects, depending on which pipeline wrote the span.
 */
export function getSpanLinkType(link: SpanLink): string | undefined {
  const raw = link.attributes?.[LINK_TYPE_ATTRIBUTE];
  const value =
    typeof raw === 'object' && raw !== null && 'value' in raw
      ? (raw as {value: unknown}).value
      : raw;
  return typeof value === 'string' ? value : undefined;
}

interface SpanLinksCellProps {
  links: SpanLink[];
  location: Location;
  organization: Organization;
  timestamp: string | number;
}

export function SpanLinksCell({
  links,
  location,
  organization,
  timestamp,
}: SpanLinksCellProps) {
  return (
    <Flex gap="xs" wrap="wrap" align="center">
      {links.map(link => (
        <SpanLinkTag
          key={`${link.trace_id}-${link.span_id}`}
          link={link}
          location={location}
          organization={organization}
          timestamp={timestamp}
        />
      ))}
    </Flex>
  );
}

interface SpanLinkTagProps {
  link: SpanLink;
  location: Location;
  organization: Organization;
  timestamp: string | number;
}

function SpanLinkTag({link, location, organization, timestamp}: SpanLinkTagProps) {
  const linkType = getSpanLinkType(link);
  const shortSpanId = getShortEventId(link.span_id);
  const target = generateLinkToEventInTraceView({
    organization,
    location,
    traceSlug: link.trace_id,
    spanId: link.span_id,
    timestamp,
    source: TraceViewSources.TRACES,
  });

  return (
    <Tooltip
      title={
        <Stack gap="2xs" align="start">
          {linkType && <Text size="sm">{tct('Type: [linkType]', {linkType})}</Text>}
          <Text size="sm">{tct('Span: [spanId]', {spanId: link.span_id})}</Text>
          <Text size="sm">{tct('Trace: [traceId]', {traceId: link.trace_id})}</Text>
          {link.sampled === false && (
            <Text size="sm" variant="muted">
              {t('The linked span was not sampled and may not be available.')}
            </Text>
          )}
        </Stack>
      }
    >
      <Link to={target}>
        <Tag variant="muted" icon={<IconLink />}>
          {linkType ? `${linkType} ${shortSpanId}` : shortSpanId}
        </Tag>
      </Link>
    </Tooltip>
  );
}
