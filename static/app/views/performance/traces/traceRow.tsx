import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FieldDateTime} from 'sentry/utils/discover/styles';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import type {IndexedResponse} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';

import {SpanIdRenderer, TraceIdRenderer} from './table/fieldRenderers';
import type {Field} from './data';

interface TraceRowProps {
  spans: Pick<IndexedResponse, Field>[];
  traceId: string;
}

export function TraceRow({traceId, spans}: TraceRowProps) {
  const location = useLocation();
  const timestamp = spans[0]?.timestamp;
  const utc = useMemo(() => {
    return decodeScalar(location?.query?.utc) === 'true';
  }, [location]);

  return (
    <TracePanel>
      <TraceInfo>
        <TraceInfoHeader>
          <TraceIdRenderer traceId={traceId} timestamp={timestamp} />
        </TraceInfoHeader>
      </TraceInfo>
      <SpanRowLayout>
        <SpansHeader lightText align="left">
          {t('Span ID')}
        </SpansHeader>
        <SpansHeader lightText align="left">
          {t('Span Op')}
        </SpansHeader>
        <SpansHeader lightText align="left">
          {t('Span Description')}
        </SpansHeader>
        <SpansHeader lightText align="right">
          {t('Span Duration')}
        </SpansHeader>
        <SpansHeader lightText align="right">
          {t('Span Self Time')}
        </SpansHeader>
        <SpansHeader lightText align="right">
          {t('Timestamp')}
        </SpansHeader>
        {spans.map(span => {
          return (
            <Fragment key={span[SpanIndexedField.ID]}>
              <SpanItem align="left">
                <SpanIdRenderer
                  projectSlug={span[SpanIndexedField.PROJECT]}
                  spanId={span[SpanIndexedField.ID]}
                  transactionId={span[SpanIndexedField.TRANSACTION_ID]}
                />
              </SpanItem>
              <SpanItem align="left">
                {span[SpanIndexedField.SPAN_OP] ? (
                  <Tooltip
                    containerDisplayMode="inline"
                    showOnlyOnOverflow
                    title={span[SpanIndexedField.SPAN_OP]}
                  >
                    {span[SpanIndexedField.SPAN_OP]}
                  </Tooltip>
                ) : (
                  <EmptyValue>{t('No Op Available')}</EmptyValue>
                )}
              </SpanItem>
              <SpanItem align="left">
                {span[SpanIndexedField.SPAN_DESCRIPTION] ? (
                  <Tooltip
                    containerDisplayMode="inline"
                    showOnlyOnOverflow
                    title={span[SpanIndexedField.SPAN_DESCRIPTION]}
                  >
                    {span[SpanIndexedField.SPAN_DESCRIPTION]}
                  </Tooltip>
                ) : (
                  <EmptyValue>{t('No Description Available')}</EmptyValue>
                )}
              </SpanItem>
              <SpanItem align="right">
                <PerformanceDuration
                  milliseconds={span[SpanIndexedField.SPAN_DURATION]}
                  abbreviation
                />
              </SpanItem>
              <SpanItem align="right">
                <PerformanceDuration
                  milliseconds={span[SpanIndexedField.SPAN_SELF_TIME]}
                  abbreviation
                />
              </SpanItem>
              <SpanItem align="right">
                <FieldDateTime date={timestamp} year seconds timeZone utc={utc} />
              </SpanItem>
            </Fragment>
          );
        })}
      </SpanRowLayout>
    </TracePanel>
  );
}

const TracePanel = styled(Panel)`
  margin-bottom: 0px;
`;

const TraceInfo = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const TraceInfoHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const SpanRowLayout = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr 2fr repeat(3, min-content);
  align-items: center;
  width: 100%;
`;

const SpansHeader = styled(PanelHeader)<{align: 'left' | 'right'}>`
  border-top: 1px solid ${p => p.theme.border};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
  ${p =>
    p.align === 'right'
      ? `
  text-align: right;
  font-variant-numeric: tabular-nums;
  `
      : ''}
`;

const SpanItem = styled(PanelItem)<{align: 'left' | 'right'}>`
  padding: ${space(1)} ${space(2)};
  ${p => p.theme.overflowEllipsis};
  ${p =>
    p.align === 'right'
      ? `
  text-align: right;
  font-variant-numeric: tabular-nums;
  `
      : ''}
`;

const EmptyValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
