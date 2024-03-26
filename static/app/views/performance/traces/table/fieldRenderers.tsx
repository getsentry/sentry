import type {FC, ReactText} from 'react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import type {DateString} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container, FieldDateTime} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import Projects from 'sentry/utils/projects';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import type {ColumnKey, DataRow} from './types';

interface FieldRendererProps {
  column: GridColumnOrder<ColumnKey>;
  row: DataRow;
}

export function getFieldRenderer(field: ColumnKey): FC<FieldRendererProps> {
  return fieldRenderers[field] ?? DefaultRenderer;
}

const fieldRenderers: Record<ReactText, FC<FieldRendererProps>> = {
  project: ProjectRenderer,
  span_id: SpanIdRenderer,
  'span.duration': SpanDurationRenderer,
  'span.self_time': SpanSelfTimeRenderer,
  timestamp: TimestampRenderer,
  trace: TraceIdRenderer,
  transaction: TransactionRenderer,
  'transaction.id': TransactionIdRenderer,
};

function DefaultRenderer({row, column}: FieldRendererProps) {
  // TODO: this can be smarter based on the type of the value
  return <Container>{row[column.key]}</Container>;
}

function ProjectRenderer(props: FieldRendererProps) {
  const projectSlug = props.row.project;

  if (!defined(projectSlug)) {
    return <DefaultRenderer {...props} />;
  }

  return <_ProjectRenderer {...props} projectSlug={projectSlug} />;
}

interface ProjectRendererProps extends FieldRendererProps {
  projectSlug: string;
}

function _ProjectRenderer({projectSlug}: ProjectRendererProps) {
  const organization = useOrganization();

  return (
    <Container>
      <Projects orgId={organization.slug} slugs={[projectSlug]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectSlug);
          return (
            <ProjectBadge
              project={project ? project : {slug: projectSlug}}
              avatarSize={16}
            />
          );
        }}
      </Projects>
    </Container>
  );
}

function SpanIdRenderer(props: FieldRendererProps) {
  const projectSlug = props.row.project;
  const spanId = props.row.span_id;
  const transactionId = props.row['transaction.id'];

  if (!defined(projectSlug) || !defined(spanId) || !defined(transactionId)) {
    return <DefaultRenderer {...props} />;
  }

  return (
    <_SpanIdRenderer
      {...props}
      projectSlug={projectSlug}
      spanId={spanId}
      transactionId={transactionId}
    />
  );
}

interface _SpanIdRendererProps extends FieldRendererProps {
  projectSlug: string;
  spanId: string;
  transactionId: string;
}

function _SpanIdRenderer({projectSlug, spanId, transactionId}: _SpanIdRendererProps) {
  const organization = useOrganization();

  const target = getTransactionDetailsUrl(
    organization.slug,
    `${projectSlug}:${transactionId}`,
    undefined,
    undefined,
    spanId
  );

  return <Link to={target}>{getShortEventId(spanId)}</Link>;
}

function TraceIdRenderer(props: FieldRendererProps) {
  const traceId = props.row.trace;

  if (!defined(traceId)) {
    return <DefaultRenderer {...props} />;
  }

  return (
    <_TraceIdRenderer
      {...props}
      traceId={traceId}
      transactionId={props.row['transaction.id'] ?? undefined}
      timestamp={props.row.timestamp}
    />
  );
}

interface TraceIdRendererProps extends FieldRendererProps {
  traceId: string;
  timestamp?: DateString;
  transactionId?: string;
}

function _TraceIdRenderer({traceId, timestamp, transactionId}: TraceIdRendererProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const stringOrNumberTimestamp =
    timestamp instanceof Date ? timestamp.toISOString() : timestamp ?? '';

  const target = getTraceDetailsUrl(
    organization,
    traceId,
    {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    {},
    stringOrNumberTimestamp,
    transactionId
  );

  return (
    <Container>
      <Link to={target}>{getShortEventId(traceId)}</Link>
    </Container>
  );
}

function TransactionIdRenderer(props: FieldRendererProps) {
  const projectSlug = props.row.project;
  const transactionId = props.row['transaction.id'];

  if (!defined(projectSlug) || !defined(transactionId)) {
    return <DefaultRenderer {...props} />;
  }

  return (
    <_TransactionIdRenderer
      {...props}
      projectSlug={projectSlug}
      transactionId={transactionId}
    />
  );
}

interface TransactionIdRendererProps extends FieldRendererProps {
  projectSlug: string;
  transactionId: string;
}

function _TransactionIdRenderer({
  projectSlug,
  transactionId,
}: TransactionIdRendererProps) {
  const organization = useOrganization();

  const target = getTransactionDetailsUrl(
    organization.slug,
    `${projectSlug}:${transactionId}`,
    undefined,
    undefined
  );

  return <Link to={target}>{getShortEventId(transactionId)}</Link>;
}

function TransactionRenderer(props: FieldRendererProps) {
  const projectSlug = props.row.project;
  const transaction = props.row.transaction;

  if (!defined(projectSlug) || !defined(transaction)) {
    return <DefaultRenderer {...props} />;
  }

  return (
    <_TransactionRenderer
      {...props}
      projectSlug={projectSlug}
      transaction={transaction}
    />
  );
}

interface TransactionRendererProps {
  projectSlug: string;
  transaction: string;
}

function _TransactionRenderer({projectSlug, transaction}: TransactionRendererProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects({slugs: [projectSlug]});

  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction,
    query: {
      ...location.query,
      query: undefined,
    },
    projectID: String(projects[0]?.id ?? ''),
  });

  return (
    <Container>
      <Link to={target}>{transaction}</Link>
    </Container>
  );
}

function TimestampRenderer(props: FieldRendererProps) {
  const location = useLocation();
  const timestamp = props.row.timestamp;

  if (!defined(timestamp)) {
    return <DefaultRenderer {...props} />;
  }

  const utc = decodeScalar(location?.query?.utc) === 'true';

  return <FieldDateTime date={timestamp} year seconds timeZone utc={utc} />;
}

function SpanDurationRenderer(props: FieldRendererProps) {
  const duration = props.row['span.duration'];

  if (!defined(duration)) {
    return <DefaultRenderer {...props} />;
  }

  return <PerformanceDuration milliseconds={duration} abbreviation />;
}

function SpanSelfTimeRenderer(props: FieldRendererProps) {
  const duration = props.row['span.duration'];

  if (!defined(duration)) {
    return <DefaultRenderer {...props} />;
  }

  return <PerformanceDuration milliseconds={duration} abbreviation />;
}
