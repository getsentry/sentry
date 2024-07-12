import styled from '@emotion/styled';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {UserReport} from 'sentry/types/group';
import {escape, nl2br} from 'sentry/utils';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type Props = {
  issueId: string;
  organization: Organization;
  projectId: string;
  report: UserReport;
  className?: string;
  showEventLink?: boolean;
};

export function EventUserFeedback({
  className,
  report,
  organization,
  projectId,
  issueId,
  showEventLink = true,
}: Props) {
  const user = report.user || {
    name: report.name,
    email: report.email,
    id: '',
    username: '',
    ip_address: '',
  };

  const {onClick, label} = useCopyToClipboard({text: report.email});

  const {isLoading, isError, isPromptDismissed, dismissPrompt, showPrompt} = usePrompt({
    feature: 'issue_feedback_hidden',
    organization,
    projectId,
  });
  console.log(isLoading, isError, isPromptDismissed);

  // const isPromptDismissed = false;

  return (
    <div className={className}>
      {isLoading || isError || isPromptDismissed ? (
        '(Hidden)'
      ) : (
        <StyledActivityItem
          date={report.dateCreated}
          author={{type: 'user', user}}
          header={
            <Items>
              <ActivityAuthor>{report.name}</ActivityAuthor>
              <CopyButton
                aria-label={label}
                borderless
                onClick={onClick}
                size="zero"
                title={label}
                tooltipProps={{delay: 0}}
                translucentBorder
                icon={<StyledIconCopy size="xs" />}
              >
                {report.email}
              </CopyButton>

              {report.eventID && showEventLink && (
                <ViewEventLink
                  to={`/organizations/${organization.slug}/issues/${issueId}/events/${report.eventID}/?referrer=user-feedback`}
                >
                  {t('View event')}
                </ViewEventLink>
              )}
            </Items>
          }
        >
          <p
            dangerouslySetInnerHTML={{
              __html: nl2br(escape(report.comments)),
            }}
          />
        </StyledActivityItem>
      )}
    </div>
  );
}

const StyledActivityItem = styled(ActivityItem)`
  margin-bottom: 0;
`;

const Items = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CopyButton = styled(Button)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const StyledIconCopy = styled(IconCopy)``;

const ViewEventLink = styled(Link)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: 0.9em;
`;
