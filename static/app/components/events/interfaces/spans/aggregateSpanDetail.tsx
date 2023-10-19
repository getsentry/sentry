import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {AggregateEventTransaction} from 'sentry/types/event';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {
  QuickTraceEvent,
  TraceErrorOrIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

import {AggregateSpanType, ParsedTraceType} from './types';

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

function renderSpanSamples(span: AggregateSpanType, project: Project | undefined) {
  if (!project) {
    return null;
  }

  return span.samples?.map(([transactionId, spanId], index) => (
    <Link
      key={`${transactionId}-${spanId}`}
      to={`/performance/${project.slug}:${transactionId}#span-${spanId}`}
    >{`${spanId}${index < span.samples.length - 1 ? ', ' : ''}`}</Link>
  ));
}

function AggregateSpanDetail({span}: Props) {
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
            <Row title={t('Span Samples')}>{renderSpanSamples(span, project)}</Row>
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
