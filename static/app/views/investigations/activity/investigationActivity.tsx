import {useMemo} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {ProgressState} from 'sentry/types/group';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationCommentsQueryOptions} from 'sentry/views/investigations/api';
import {getBlockDisplayTitle} from 'sentry/views/investigations/detail/cell';
import type {
  InvestigationComment,
  InvestigationDetail,
} from 'sentry/views/investigations/types';
import {
  ActivityLineContent,
  ActivityLineHeadline,
  ActivityLineList,
  ActivityLineRow,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {ActivityProgressMarker} from 'sentry/views/issueDetails/activitySection/activityLineItem/progressMarker/progressMarker';

function useInvestigationComments(investigationId: string) {
  const organization = useOrganization();
  return useQuery({
    ...investigationCommentsQueryOptions({
      organizationSlug: organization.slug,
      investigationId,
    }),
    refetchInterval: 10_000,
    select: selectJsonWithHeaders,
  });
}

export function InvestigationActivity({
  investigation,
}: {
  investigation: InvestigationDetail;
}) {
  const {data, isPending, refetch} = useInvestigationComments(investigation.id);
  const blockTitles = useMemo(
    () =>
      new Map(
        (investigation.blocks ?? []).map(block => [block.id, getBlockDisplayTitle(block)])
      ),
    [investigation.blocks]
  );
  const comments = data?.json ?? [];
  const hasOlder = parseLinkHeader(data?.headers.Link ?? null).next?.results === true;

  return (
    <Stack as="section" gap="lg" paddingTop="2xl" borderTop="primary">
      <Heading as="h2" size="lg">
        {t('Activity')}
      </Heading>
      {isPending ? (
        <LoadingIndicator mini />
      ) : data === undefined ? (
        <LoadingError onRetry={refetch} />
      ) : (
        <ActivityList as="ol" aria-label={t('Activity')}>
          {comments.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              blockTitle={comment.blockId ? blockTitles.get(comment.blockId) : undefined}
            />
          ))}
          {hasOlder ? (
            <ActivityLineRow as="li">
              <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
                <ActivityProgressMarker state="activity" label={t('Older comments')} />
              </Grid>
              <Text variant="muted" density="comfortable">
                {t('Showing the latest 100 comments.')}
              </Text>
            </ActivityLineRow>
          ) : null}
          <ActivityLineRow as="li">
            <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
              <ActivityProgressMarker
                state={ProgressState.IDENTIFIED}
                label={t('Created')}
              />
            </Grid>
            <ActivityLineHeadline
              title={t('Investigation first created')}
              timestamp={<TimeSince date={investigation.dateCreated} />}
            />
          </ActivityLineRow>
        </ActivityList>
      )}
    </Stack>
  );
}

function CommentRow({
  comment,
  blockTitle,
}: {
  comment: InvestigationComment;
  blockTitle?: string;
}) {
  return (
    <ActivityLineRow as="li">
      <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
        {comment.author ? (
          <UserAvatar user={comment.author} size={22} hasTooltip />
        ) : (
          <ActivityProgressMarker state="activity" label={t('Comment')} />
        )}
      </Grid>
      <Flex
        column={2}
        row={1}
        align="center"
        wrap="wrap"
        gap="xs"
        minHeight="22px"
        minWidth={0}
      >
        <Text bold density="comfortable">
          {tct('[author] commented', {
            author: comment.author
              ? comment.author.name || comment.author.email
              : t('Unknown user'),
          })}
        </Text>
        {comment.blockId ? (
          <Text variant="muted" density="comfortable">
            {tct('on [block]', {block: blockTitle ?? t('a deleted block')})}
          </Text>
        ) : null}
        <Text variant="muted" density="comfortable">
          &bull;
        </Text>
        <Text variant="muted" density="comfortable" wrap="nowrap">
          <TimeSince date={comment.dateCreated} />
        </Text>
      </Flex>
      <ActivityLineContent>
        <Container
          background="secondary"
          border="primary"
          radius="lg"
          padding="sm md"
          marginTop="xs"
        >
          <NoteBody text={comment.body} />
        </Container>
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

const ActivityList = styled(ActivityLineList)`
  margin: 0;
  padding: 0;
  list-style: none;
`;
