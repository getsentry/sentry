import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useRole} from 'sentry/components/acl/useRole';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackTimestampsTooltip from 'sentry/components/feedback/feedbackItem/feedbackTimestampsTooltip';
import {ScreenshotSection} from 'sentry/components/feedback/feedbackItem/screenshotSection';
import TimeSince from 'sentry/components/timeSince';
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
    </Fragment>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  align-self: center;
  white-space: nowrap;
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
    font-size: ${p => p.theme.fontSize.md};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
    color: ${p => p.theme.textColor};
  }
`;
