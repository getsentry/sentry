import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import type {DateString} from 'sentry/types';
import {Container} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import Projects from 'sentry/utils/projects';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

interface ProjectRendererProps {
  projectSlug: string;
}

export function ProjectRenderer({projectSlug}: ProjectRendererProps) {
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

interface SpanIdRendererProps {
  projectSlug: string;
  spanId: string;
  transactionId: string;
}

export function SpanIdRenderer({
  projectSlug,
  spanId,
  transactionId,
}: SpanIdRendererProps) {
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

interface TraceIdRendererProps {
  traceId: string;
  timestamp?: DateString;
  transactionId?: string;
}

export function TraceIdRenderer({
  traceId,
  timestamp,
  transactionId,
}: TraceIdRendererProps) {
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

interface TransactionIdRendererProps {
  projectSlug: string;
  transactionId: string;
}

export function TransactionIdRenderer({
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

interface TransactionRendererProps {
  projectSlug: string;
  transaction: string;
}

export function TransactionRenderer({
  projectSlug,
  transaction,
}: TransactionRendererProps) {
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
