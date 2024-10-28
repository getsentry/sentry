import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useGroupUserFeedback} from 'sentry/views/issueDetails/useGroupUserFeedback';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';
import {UserFeedbackEmpty} from 'sentry/views/userFeedback/userFeedbackEmpty';

interface GroupUserFeedbackProps {
  group: Group;
}

function GroupUserFeedback({group}: GroupUserFeedbackProps) {
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const location = useLocation();
  const {
    data: reportList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useGroupUserFeedback({
    groupId: group.id,
    query: {
      cursor: location.query.cursor as string | undefined,
    },
  });

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isPending) {
    return (
      <StyledLayoutBody hasStreamlinedUI={hasStreamlinedUI}>
        <Layout.Main fullWidth>
          <LoadingIndicator />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  const pageLinks = getResponseHeader?.('Link');

  return (
    <StyledLayoutBody hasStreamlinedUI={hasStreamlinedUI}>
      <Layout.Main fullWidth>
        {reportList.length === 0 ? (
          <UserFeedbackEmpty projectIds={[group.project.id]} issueTab />
        ) : (
          <Fragment>
            {reportList.map((item, idx) => (
              <StyledEventUserFeedback
                key={idx}
                report={item}
                orgSlug={organization.slug}
                issueId={group.id}
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
  margin-bottom: ${space(2)};
`;

const StyledLayoutBody = styled(Layout.Body)<{hasStreamlinedUI?: boolean}>`
  ${p =>
    p.hasStreamlinedUI &&
    css`
      border: 1px solid ${p.theme.border};
      border-radius: ${p.theme.borderRadius};
      padding: ${space(2)} 0;

      @media (min-width: ${p.theme.breakpoints.medium}) {
        padding: ${space(2)} ${space(2)};
      }
    `}
`;

export default GroupUserFeedback;
