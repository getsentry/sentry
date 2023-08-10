import styled from '@emotion/styled';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {UserReport} from 'sentry/types';
import {escape, nl2br} from 'sentry/utils';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type Props = {
  issueId: string;
  orgSlug: string;
  report: UserReport;
  className?: string;
};

export function EventUserFeedback({className, report, orgSlug, issueId}: Props) {
  const user = report.user || {
    name: report.name,
    email: report.email,
    id: '',
    username: '',
    ip_address: '',
  };

  const {onClick, label} = useCopyToClipboard({text: report.email});

  return (
    <div className={className}>
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

            {report.eventID && (
              <ViewEventLink
                to={`/organizations/${orgSlug}/issues/${issueId}/events/${report.eventID}/?referrer=user-feedback`}
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
  font-weight: normal;
`;

const StyledIconCopy = styled(IconCopy)``;

const ViewEventLink = styled(Link)`
  font-weight: 300;
  font-size: 0.9em;
`;
