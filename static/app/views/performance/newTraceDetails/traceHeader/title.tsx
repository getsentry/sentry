import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ReplayContextKey} from 'sentry/types/event';
import {FieldKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {Divider} from 'sentry/views/issueDetails/divider';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {findSpanAttributeValue} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface TitleProps {
  representativeEvent: TraceTree.RepresentativeTraceEvent | null;
  rootEventResults: TraceRootEventQueryResults;
}

function getTitle(representativeEvent: TraceTree.RepresentativeTraceEvent | null): {
  title: string;
  subtitle?: string;
} | null {
  const event = representativeEvent?.event;
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

  return event.traceHeaderTitle ?? null;
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
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

export function Title({representativeEvent, rootEventResults}: TitleProps) {
  const traceTitle = getTitle(representativeEvent);

  if (traceTitle) {
    return (
      <Stack align="start" width="75%">
        <Text size="xl" bold ellipsis>
          {traceTitle.title}
        </Text>
        {traceTitle.subtitle && (
          <Flex align="center" gap="sm" width="100%">
            <Text size="md" ellipsis variant="muted">
              {traceTitle.subtitle}
            </Text>
            <ContextBadges rootEventResults={rootEventResults} />
          </Flex>
        )}
      </Stack>
    );
  }

  return (
    <Text bold size="xl">
      {t('Trace')}
    </Text>
  );
}
