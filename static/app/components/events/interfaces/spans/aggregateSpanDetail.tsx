import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {AggregateEventTransaction} from 'sentry/types/event';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatPercentage} from 'sentry/utils/formatters';
import {QuickTraceEvent, TraceError} from 'sentry/utils/performance/quickTrace/types';

import {AggregateSpanType, ParsedTraceType} from './types';

type Props = {
  childTransactions: QuickTraceEvent[] | null;
  event: Readonly<AggregateEventTransaction>;
  isRoot: boolean;
  organization: Organization;
  relatedErrors: TraceError[] | null;
  resetCellMeasureCache: () => void;
  scrollToHash: (hash: string) => void;
  span: AggregateSpanType;
  trace: Readonly<ParsedTraceType>;
};

function AggregateSpanDetail({span}: Props) {
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
            <Row title={t('avg(duration)')}>{getDuration(avgDuration)}</Row>
            <Row title={t('frequency')}>{frequency && formatPercentage(frequency)}</Row>
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
