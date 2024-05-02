import styled from '@emotion/styled';
import type {Location} from 'history';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import type {AggregateEventTransaction} from 'sentry/types/event';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/formatters';
import type {
  QuickTraceEvent,
  TraceErrorOrIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

import type {AggregateSpanType, ParsedTraceType} from './types';

type Props = {
  childTransactions: QuickTraceEvent[] | null;
  event: Readonly<AggregateEventTransaction>;
  isRoot: boolean;
  organization: Organization;
  relatedErrors: TraceErrorOrIssue[] | null;
  resetCellMeasureCache: () => void;
  scrollToHash: (hash: string) => void;
  span: AggregateSpanType;
  trace: Readonly<ParsedTraceType>;
};

function renderSpanSamples(
  aggSpan: AggregateSpanType,
  project: Project | undefined,
  location: Location,
  organization: Organization
) {
  if (!project) {
    return null;
  }

  return aggSpan.samples?.map(({transaction, span, trace, timestamp}, index) => (
    <Link
      key={`${transaction}-${span}`}
      to={generateLinkToEventInTraceView({
        organization,
        traceSlug: trace,
        projectSlug: project.slug,
        eventId: transaction,
        timestamp,
        location,
        spanId: span,
      })}
    >{`${span}${index < aggSpan.samples.length - 1 ? ', ' : ''}`}</Link>
  ));
}

function AggregateSpanDetail({span, organization}: Props) {
  const location = useLocation();
  const {projects} = useProjects();

  const project = projects.find(p => p.id === location.query.project);

  const frequency = span?.frequency;
  const avgDuration = span?.timestamp - span?.start_timestamp;

  return (
    <SpanDetailContainer
      data-component="span-detail"
      onClick={event => {
        // prevent toggling the span detail
        event.stopPropagation();
      }}
    >
      <SpanDetails>
        <table className="table key-value">
          <tbody>
            <Row title={t('Avg Duration')}>{getDuration(avgDuration)}</Row>
            <Row title={t('Frequency')}>{frequency && formatPercentage(frequency)}</Row>
            <Row title={t('Span Samples')}>
              {renderSpanSamples(span, project, location, organization)}
            </Row>
          </tbody>
        </table>
      </SpanDetails>
    </SpanDetailContainer>
  );
}

export default AggregateSpanDetail;

export function Row({
  title,
  keep,
  children,
  prefix,
  extra = null,
}: {
  children: React.ReactNode;
  title: JSX.Element | string | null;
  extra?: React.ReactNode;
  keep?: boolean;
  prefix?: JSX.Element;
}) {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">
        <Flex>
          {prefix}
          {title}
        </Flex>
      </td>
      <ValueTd className="value">
        <ValueRow>
          <StyledPre>
            <span className="val-string">{children}</span>
          </StyledPre>
          <ButtonContainer>{extra}</ButtonContainer>
        </ValueRow>
      </ValueTd>
    </tr>
  );
}

export const SpanDetailContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: auto;
`;

const ValueTd = styled('td')`
  position: relative;
`;

const Flex = styled('div')`
  display: flex;
  align-items: center;
`;

const ValueRow = styled('div')`
  display: grid;
  grid-template-columns: auto min-content;
  gap: ${space(1)};

  border-radius: 4px;
  background-color: ${p => p.theme.surface200};
  margin: 2px;
`;

const StyledPre = styled('pre')`
  margin: 0 !important;
  background-color: transparent !important;
`;

const ButtonContainer = styled('div')`
  padding: 8px 10px;
`;

export const SpanDetails = styled('div')`
  padding: ${space(2)};

  table.table.key-value td.key {
    max-width: 280px;
  }
`;
