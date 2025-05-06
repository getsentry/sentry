import styled from '@emotion/styled';

import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Button} from 'sentry/components/core/button';
import Link from 'sentry/components/links/link';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UserReport} from 'sentry/types/group';
import {escape, nl2br} from 'sentry/utils';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {makeFeedbackPathname} from 'sentry/views/userFeedback/pathnames';

type Props = {
  issueId: string;
  orgSlug: string;
  report: UserReport;
  className?: string;
  showEventLink?: boolean;
};

export function EventUserFeedback({
  className,
  report,
  orgSlug,
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
  const {selection} = usePageFilters();
  const organization = useOrganization();

  return (
    <div className={className}>
      <StyledActivityItem
        date={report.dateCreated}
        author={{type: 'user', user}}
        header={
          <Items>
            <ActivityAuthor>
              <Link
                to={{
                  pathname: makeFeedbackPathname({
                    path: '/',
                    organization,
                  }),
                  query: {
                    project: selection.projects.length ? selection.projects[0] : -1,
                    query: `associated_event_id:${report.eventID}`,
                    referrer: 'feedback_list_page',
                    statsPeriod: selection.datetime.period,
                  },
                }}
              >
                {report.name}
              </Link>
            </ActivityAuthor>
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
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const StyledIconCopy = styled(IconCopy)``;

const ViewEventLink = styled(Link)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: 0.9em;
`;
