import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FeedbackEmptyState} from 'sentry/views/feedback/feedbackEmptyState';

import {useGroupId} from './groupIdContext';
import {groupUserFeedbackApiOptions} from './groupUserFeedbackApiOptions';
import {useGroup} from './useGroup';

function GroupUserFeedback() {
  const organization = useOrganization();
  const [cursor] = useQueryState('cursor', parseAsString);
  const groupId = useGroupId();

  const {
    data: group,
    isPending: isPendingGroup,
    isError: isErrorGroup,
    refetch: refetchGroup,
  } = useGroup({
    groupId,
  });

  const {data, isPending, isError, refetch} = useQuery({
    ...groupUserFeedbackApiOptions(organization, {
      groupId,
      query: {
        cursor: cursor ?? undefined,
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
      <Layout.Body border="primary" radius="md" padding={{zero: 'lg 0', '3xs': 'lg'}}>
        <Layout.Main width="full">
          <LoadingIndicator />
        </Layout.Main>
      </Layout.Body>
    );
  }

  const reportList = data?.json ?? [];
  const pageLinks = data?.headers.Link;
  const hasUserFeedback = group.project.hasUserReports;

  return (
    <Layout.Body border="primary" radius="md" padding={{zero: 'lg 0', '3xs': 'lg'}}>
      <Layout.Main width="full">
        {hasUserFeedback && (
          <Text as="div" variant="muted">
            {t('The feedback shown below is not subject to search filters.')}
            <Separator orientation="horizontal" margin="md 0" />
          </Text>
        )}
        {reportList.length === 0 ? (
          <FeedbackEmptyState projectIds={[group.project.id]} issueTab />
        ) : (
          <Stack gap="xl">
            {reportList.map(item => (
              <EventUserFeedback
                key={item.id}
                report={item}
                eventLink={`/organizations/${organization.slug}/issues/${groupId}/events/${item.eventID}/?referrer=user-feedback`}
              />
            ))}
            <Pagination {...getPaginationProps(pageLinks)} />
          </Stack>
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupUserFeedback;
