import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  representativeEvent: TraceTree.TraceEvent | OurLogsResponseItem | null;
  tree: TraceTree;
}
function getTitle(event: TraceTree.TraceEvent | OurLogsResponseItem | null): {
  subtitle: string | undefined;
  title: string;
} | null {
  if (!event) {
    return null;
  }

  // Handle log events
  if (OurLogKnownFieldKey.SEVERITY_TEXT in event) {
    return {
      title: t('Trace'),
      subtitle: event[OurLogKnownFieldKey.BODY],
    };
  }

  // Handle error events
  if (isEAPError(event) || isTraceError(event)) {
    const subtitle = isEAPError(event) ? event.description : event.title || event.message;

    return {
      title: t('Trace'),
      subtitle,
    };
  }

  if (!('transaction' in event)) {
    return null;
  }

  // Normalize operation field access across event types
  const op =
    'transaction.op' in event ? event['transaction.op'] : 'op' in event ? event.op : '';

  return {
    title: op || t('Trace'),
    subtitle: event.transaction,
  };
}

export function Title({representativeEvent}: TitleProps) {
  const traceTitle = getTitle(representativeEvent);

  return (
    <div>
      {traceTitle ? (
        <TitleWrapper>
          <TitleText>{traceTitle.title}</TitleText>
          {traceTitle.subtitle && <SubtitleText>{traceTitle.subtitle}</SubtitleText>}
        </TitleWrapper>
      ) : (
        <TitleText>{t('Trace')}</TitleText>
      )}
    </div>
  );
}

const TitleWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
`;

const TitleText = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.theme.overflowEllipsis};
`;

const SubtitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;
