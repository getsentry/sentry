import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {SectionHeading} from 'sentry/components/charts/styles';
import Times from 'sentry/components/group/times';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import SeenByList from 'sentry/components/seenByList';
import ShortId from 'sentry/components/shortId';
import GroupChart from 'sentry/components/stream/groupChart';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

type Props = {
  eventId: string;
  groupId: string;
};

function LinkedIssue({eventId, groupId}: Props) {
  const groupUrl = `/issues/${groupId}/`;

  const {
    data: group,
    isLoading,
    isError,
    error,
  } = useApiQuery<Group>([groupUrl], {staleTime: 0});

  if (isLoading) {
    return <Placeholder height="120px" bottomGutter={2} />;
  }

  if (isError || !group) {
    const hasNotFound = error.status === 404;

    if (hasNotFound) {
      return (
        <Alert type="warning" showIcon>
          {t('The linked issue cannot be found. It may have been deleted, or merged.')}
        </Alert>
      );
    }

    return <LoadingError />;
  }

  const issueUrl = `${group.permalink}events/${eventId}/`;

  return (
    <Section>
      <SectionHeading>{t('Event Issue')}</SectionHeading>
      <StyledIssueCard>
        <IssueCardHeader>
          <StyledLink to={issueUrl} data-test-id="linked-issue">
            <StyledShortId
              shortId={group.shortId}
              avatar={
                <ProjectBadge
                  project={group.project}
                  avatarSize={16}
                  hideName
                  disableLink
                />
              }
            />
          </StyledLink>
          <SeenByList seenBy={group.seenBy} maxVisibleAvatars={5} />
        </IssueCardHeader>
        <IssueCardBody>
          <GroupChart statsPeriod="30d" data={group} height={56} />
        </IssueCardBody>
        <IssueCardFooter>
          <Times lastSeen={group.lastSeen} firstSeen={group.firstSeen} />
        </IssueCardFooter>
      </StyledIssueCard>
    </Section>
  );
}

const Section = styled('div')`
  margin-bottom: ${space(4)};
`;

const StyledIssueCard = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const IssueCardHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
`;

const StyledLink = styled(Link)`
  justify-content: flex-start;
`;

const IssueCardBody = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  padding-top: ${space(1)};
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
`;

const IssueCardFooter = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(0.5)} ${space(1)};
`;

export default LinkedIssue;
