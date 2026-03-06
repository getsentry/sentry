import {Fragment} from 'react';
import styled from '@emotion/styled';

import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {FeedbackEmptyState} from 'sentry/views/feedback/feedbackEmptyState';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupUserFeedback} from 'sentry/views/issueDetails/useGroupUserFeedback';

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

  const {
    data: reportList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useGroupUserFeedback({
    groupId: params.groupId,
    query: {
      cursor: location.query.cursor as string | undefined,
    },
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

  const pageLinks = getResponseHeader?.('Link');
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
          <Fragment>
            {reportList.map((item, idx) => (
              <StyledEventUserFeedback
                key={idx}
                report={item}
                orgSlug={organization.slug}
                issueId={params.groupId}
              />
            ))}
            <Pagination pageLinks={pageLinks} />
          </Fragment>
        )}
      </Layout.Main>
    </StyledLayoutBody>
  );
}

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin-bottom: ${p => p.theme.space.xl};
`;

const StyledLayoutBody = styled(Layout.Body)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1.5)} 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(1.5)};
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
