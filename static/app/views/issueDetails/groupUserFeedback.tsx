import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {FeedbackEmptyState} from 'sentry/views/feedback/feedbackEmptyState';
import {groupUserFeedbackApiOptions} from 'sentry/views/issueDetails/groupUserFeedbackApiOptions';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

function GroupUserFeedback() {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{groupId: string}>();

  const {
    data: group,
    isPending: isPendingGroup,
    isError: isErrorGroup,
    refetch: refetchGroup,
  } = useGroup({
    groupId: params.groupId,
  });

  const {data, isPending, isError, refetch} = useQuery({
    ...groupUserFeedbackApiOptions(organization, {
      groupId: params.groupId,
      query: {
        cursor: location.query.cursor,
      },
    }),
    select: selectJsonWithHeaders,
  });

  if (isError || isErrorGroup) {
    return (
      <LoadingError
        onRetry={() => {
          refetch();
          refetchGroup();
        }}
      />
    );
  }

  if (isPending || isPendingGroup) {
    return (
      <StyledLayoutBody>
        <Layout.Main width="full">
          <LoadingIndicator />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  const reportList = data?.json ?? [];
  const pageLinks = data?.headers.Link;
  const hasUserFeedback = group.project.hasUserReports;

  return (
    <StyledLayoutBody>
      <Layout.Main width="full">
        {hasUserFeedback && (
          <FilterMessage>
            {t('The feedback shown below is not subject to search filters.')}
            <StyledBreak />
          </FilterMessage>
        )}
        {reportList.length === 0 ? (
          <FeedbackEmptyState projectIds={[group.project.id]} issueTab />
        ) : (
          <Stack gap="xl">
            {reportList.map(item => (
              <EventUserFeedback
                key={item.id}
                report={item}
                eventLink={`/organizations/${organization.slug}/issues/${params.groupId}/events/${item.eventID}/?referrer=user-feedback`}
              />
            ))}
            <Pagination pageLinks={pageLinks} />
          </Stack>
        )}
      </Layout.Main>
    </StyledLayoutBody>
  );
}

const StyledLayoutBody = styled(Layout.Body)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg} 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space.lg};
  }
`;

const FilterMessage = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledBreak = styled('hr')`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
  border-color: ${p => p.theme.tokens.border.primary};
`;

export default GroupUserFeedback;
