import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useRole} from 'sentry/components/acl/useRole';
import Tag from 'sentry/components/badge/tag';
import {Flex} from 'sentry/components/container/flex';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackTimestampsTooltip from 'sentry/components/feedback/feedbackItem/feedbackTimestampsTooltip';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import {ScreenshotSection} from 'sentry/components/feedback/feedbackItem/screenshotSection';
import ExternalLink from 'sentry/components/links/externalLink';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function MessageSection({eventData, feedbackItem}: Props) {
  const organization = useOrganization();
  const {hasRole} = useRole({role: 'attachmentsRole'});
  const project = feedbackItem.project;
  const isSpam = eventData?.occurrence?.evidenceData.isSpam;

  return (
    <Fragment>
      <Flex wrap="wrap" flex="1 1 auto" gap={space(1)} justify="space-between">
        <FeedbackItemUsername feedbackIssue={feedbackItem} />
        <Flex gap={space(1)}>
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
      <Blockquote>
        <pre>{feedbackItem.metadata.message}</pre>

        {eventData && project && hasRole ? (
          <ScreenshotSection
            event={eventData}
            organization={organization}
            projectSlug={project.slug}
          />
        ) : null}
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

  display: flex;
  flex-direction: column;
  gap: ${space(2)};

  border-left: 2px solid ${p => p.theme.purple300};
  padding: ${space(2)};

  & > pre {
    margin-bottom: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
    color: ${p => p.theme.textColor};
  }
`;
