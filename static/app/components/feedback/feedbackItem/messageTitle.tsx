import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {FeedbackItemUsername} from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import {FeedbackTimestampsTooltip} from 'sentry/components/feedback/feedbackItem/feedbackTimestampsTooltip';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export function MessageTitle({feedbackItem, eventData}: Props) {
  const isSpam = eventData?.occurrence?.evidenceData.isSpam;

  return (
    <Flex wrap="wrap" flex="1 1 auto" gap="md" justify="between">
      <FeedbackItemUsername feedbackIssue={feedbackItem} />
      <Flex gap="md">
        {isSpam ? (
          <Tag key="spam" variant="danger">
            <InfoText
              variant="inherit"
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
            </InfoText>
          </Tag>
        ) : null}
        <StyledTimeSince
          date={feedbackItem.firstSeen}
          disabledAbsoluteTooltip={!eventData}
          tooltipBody={
            eventData ? (
              <FeedbackTimestampsTooltip feedbackItem={feedbackItem} />
            ) : undefined
          }
          maxWidth={300}
        />
      </Flex>
    </Flex>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  align-self: center;
  white-space: nowrap;
`;
