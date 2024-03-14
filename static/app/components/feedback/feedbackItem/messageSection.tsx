import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackTimestampsTooltip from 'sentry/components/feedback/feedbackItem/feedbackTimestampsTooltip';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import {Flex} from 'sentry/components/profiling/flex';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function MessageSection({eventData, feedbackItem}: Props) {
  return (
    <Fragment>
      <Flex wrap="wrap" flex="1 1 auto" gap={space(1)} justify="space-between">
        <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay />

        <StyledTimeSince
          date={feedbackItem.firstSeen}
          tooltipProps={{
            title: eventData ? (
              <FeedbackTimestampsTooltip feedbackItem={feedbackItem} />
            ) : undefined,
            overlayStyle: {maxWidth: 300},
          }}
        />
      </Flex>
      <Blockquote>
        <pre>{feedbackItem.metadata.message}</pre>
      </Blockquote>
      <Flex justify="flex-end">
        <Flex gap={space(1)} align="center">
          <SeenBy>{t('Seen by')}</SeenBy>
          <FeedbackViewers feedbackItem={feedbackItem} />
        </Flex>
      </Flex>
    </Fragment>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  align-self: center;
  white-space: nowrap;
`;

const SeenBy = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const Blockquote = styled('blockquote')`
  margin: 0;
  background: ${p => p.theme.purple100};

  border-left: 2px solid ${p => p.theme.purple300};
  padding: ${space(2)};

  & > pre {
    margin: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
    color: ${p => p.theme.purple400};
  }
`;
