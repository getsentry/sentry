import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ReplayContextKey} from 'sentry/types/event';
import {FieldKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {Divider} from 'sentry/views/issueDetails/divider';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  isTraceItemDetailsResponse,
  type RepresentativeTraceEvent,
} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {findSpanAttributeValue} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface TitleProps {
  representativeEvent: RepresentativeTraceEvent;
  rootEventResults: TraceRootEventQueryResults;
}

function getTitle(representativeEvent: RepresentativeTraceEvent): {
  subtitle: string | undefined;
  title: string;
} | null {
  const {event} = representativeEvent;
  if (!event) {
    return null;
  }

  // Handle log events
  if (OurLogKnownFieldKey.SEVERITY in event) {
    return {
      title: t('Trace'),
      subtitle: event[OurLogKnownFieldKey.MESSAGE],
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
  const organization = useOrganization();

  if (!rootEventResults.data) {
    return null;
  }

  const replayId = isTraceItemDetailsResponse(rootEventResults.data)
    ? findSpanAttributeValue(rootEventResults.data.attributes, FieldKey.REPLAY_ID)
    : rootEventResults.data.contexts.replay?.[ReplayContextKey.REPLAY_ID];

  if (!replayId) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <ReplayButton
        type="button"
        priority="link"
        icon={<IconPlay size="xs" />}
        to={{
          pathname: makeReplaysPathname({
            path: `/${replayId}/`,
            organization,
          }),
        }}
        aria-label={t("View this issue's replay")}
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
  font-size: ${p => p.theme.fontSize.xl};
  ${p => p.theme.overflowEllipsis};
`;

const SubtitleText = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
