import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type EventTransaction, ReplayContextKey} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {Divider} from 'sentry/views/issueDetails/divider';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  representativeEvent: TraceTree.TraceEvent | OurLogsResponseItem | null;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
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

function ContextBadges({rootEventResults}: Pick<TitleProps, 'rootEventResults'>) {
  if (!rootEventResults.data) {
    return null;
  }

  const replay_id = rootEventResults.data.contexts.replay?.[ReplayContextKey.REPLAY_ID];

  return (
    <Fragment>
      <Divider />
      <ReplayButton
        type="button"
        priority="link"
        icon={<IconPlay size="xs" />}
        to={{
          pathname: `/explore/replays/${replay_id}`,
        }}
        replace
        aria-label={t("View this issue's replays")}
      >
        {t('1 Replay')}
      </ReplayButton>
    </Fragment>
  );
}

const ReplayButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

export function Title({representativeEvent, rootEventResults}: TitleProps) {
  const traceTitle = getTitle(representativeEvent);

  return (
    <div>
      {traceTitle ? (
        <TitleWrapper>
          <TitleText>{traceTitle.title}</TitleText>
          {traceTitle.subtitle && (
            <SubtitleText>
              {traceTitle.subtitle}
              <ContextBadges rootEventResults={rootEventResults} />
            </SubtitleText>
          )}
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
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
