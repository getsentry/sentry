import {useMemo} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Container, FieldDateTime, NumberContainer} from 'sentry/utils/discover/styles';
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
      <SpansHeader lightText>
        <SpanRowLayout>
          <Container>{t('Span ID')}</Container>
          <Container>{t('Span Op')}</Container>
          <Container>{t('Span Description')}</Container>
          <NumberContainer>{t('Span Duration')}</NumberContainer>
          <NumberContainer>{t('Span Self Time')}</NumberContainer>
          <NumberContainer>{t('Timestamp')}</NumberContainer>
        </SpanRowLayout>
      </SpansHeader>
      {spans.map(span => {
        return (
          <SpanItem key={span[SpanIndexedField.ID]}>
            <SpanRowLayout>
              <SpanIdRenderer
                projectSlug={span[SpanIndexedField.PROJECT]}
                spanId={span[SpanIndexedField.ID]}
                transactionId={span[SpanIndexedField.TRANSACTION_ID]}
              />
              <Container>{span[SpanIndexedField.SPAN_OP]}</Container>
              <Container>{span[SpanIndexedField.SPAN_DESCRIPTION]}</Container>
              <NumberContainer>
                <PerformanceDuration
                  milliseconds={span[SpanIndexedField.SPAN_DURATION]}
                  abbreviation
                />
              </NumberContainer>
              <NumberContainer>
                <PerformanceDuration
                  milliseconds={span[SpanIndexedField.SPAN_SELF_TIME]}
                  abbreviation
                />
              </NumberContainer>
              <NumberContainer>
                <FieldDateTime date={timestamp} year seconds timeZone utc={utc} />
              </NumberContainer>
            </SpanRowLayout>
          </SpanItem>
        );
      })}
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
  grid-template-columns: 80px repeat(5, 1fr);
  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;
`;

const SpansHeader = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.border};
  border-top-left-radius: 0;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SpanItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;
