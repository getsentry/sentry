import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackTimestampsTooltip from 'sentry/components/feedback/feedbackItem/feedbackTimestampsTooltip';
import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function MessageTitle({feedbackItem, eventData}: Props) {
  const isSpam = eventData?.occurrence?.evidenceData.isSpam;

  return (
    <Flex wrap="wrap" flex="1 1 auto" gap="md" justify="between">
      <FeedbackItemUsername feedbackIssue={feedbackItem} />
      <Flex gap="md">
        {isSpam ? (
          <Tag key="spam" type="error">
            <Tooltip
              isHoverable
              position="left"
              title={tct(
                'This feedback was automatically marked as spam. Learn more by [link:reading our docs.]',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/user-feedback/#spam-detection-for-user-feedback" />
                  ),
                }
              )}
            >
              {t('spam')}
            </Tooltip>
          </Tag>
        ) : null}
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
    </Flex>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  align-self: center;
  white-space: nowrap;
`;
