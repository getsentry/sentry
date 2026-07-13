import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Avatar, UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {TimeSince} from 'sentry/components/timeSince';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  GroupActivityType,
  type Group,
  type GroupActivityPullRequestClosed,
  type GroupActivitySetByResolvedInPullRequest,
} from 'sentry/types/group';
import type {
  LinkedPullRequest,
  LinkedPullRequestsResponse,
  PullRequestAuthor,
  PullRequestAttribution,
} from 'sentry/types/integrations';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getPullRequestStatusLabel,
  PullRequestStatusBadge,
} from './pullRequestStatusBadge';

const PULL_REQUEST_ACTIVITY_TYPES = new Set([
  GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
  GroupActivityType.PULL_REQUEST_CLOSED,
]);

export function getLinkedPullRequestActivityIds(group: Group) {
  return new Set(
    group.activity
      .filter(
        (
          activity
        ): activity is
          | GroupActivityPullRequestClosed
          | GroupActivitySetByResolvedInPullRequest =>
          PULL_REQUEST_ACTIVITY_TYPES.has(activity.type)
      )
      .map(activity => {
        return activity.data.pullRequest?.id;
      })
      .filter(id => id !== undefined)
  );
}

interface LinkedPullRequestsProps {
  group: Group;
  showEmptyState?: boolean;
}

function LinkedPullRequestRow({
  group,
  pullRequest,
}: {
  group: Group;
  pullRequest: LinkedPullRequest;
}) {
  const organization = useOrganization();
  const title = pullRequest.title ?? t('Pull request #%s', pullRequest.id);
  const statusLabel = getPullRequestStatusLabel(pullRequest.status);
  const pullRequestLabel = t('#%s', pullRequest.id);
  const author = getPullRequestAuthor(pullRequest);

  return (
    <Tooltip
      title={
        <Text as="span" align="left" wordBreak="break-word">
          {title}
        </Text>
      }
      maxWidth={275}
      skipWrapper
    >
      <PullRequestRow
        aria-label={t(
          'Pull request #%s in %s, %s, %s',
          pullRequest.id,
          pullRequest.repository.name,
          statusLabel,
          title
        )}
        href={pullRequest.externalUrl}
        onClick={() =>
          trackAnalytics('issue_details.external_issue_pull_request_clicked', {
            organization,
            attribution_type: pullRequest.attribution?.type,
            pull_request_id: pullRequest.id,
            pull_request_status: pullRequest.status,
            repository_id: pullRequest.repository.id,
            repository_provider: pullRequest.repository.provider.id,
            ...getAnalyticsDataForGroup(group),
          })
        }
      >
        <Grid columns="max-content minmax(0, 1fr)" gap="sm" padding="sm">
          <Flex as="span" aria-hidden align="start">
            <RepoProviderIcon
              provider={pullRequest.repository.provider.id}
              size="sm"
              variant="muted"
            />
          </Flex>
          <Stack gap="xs" minWidth={0}>
            <PullRequestTitle>
              <Text as="span" bold textWrap="nowrap">
                {pullRequestLabel}
              </Text>
              <Text as="span" ellipsis>
                {pullRequest.repository.name}
              </Text>
            </PullRequestTitle>
            <Flex align="center" gap="xs">
              <PullRequestStatusBadge status={pullRequest.status} />
              {pullRequest.attribution ? (
                <PullRequestAttributionAvatar attribution={pullRequest.attribution} />
              ) : author ? (
                <PullRequestAuthorAvatar author={author} />
              ) : null}
              <Text as="span" size="sm" variant="muted">
                <TimeSince
                  date={pullRequest.dateLinked}
                  suffix={t('ago')}
                  tooltipPrefix={t('Linked')}
                  unitStyle="short"
                />
              </Text>
            </Flex>
          </Stack>
        </Grid>
      </PullRequestRow>
    </Tooltip>
  );
}

function PullRequestAttributionAvatar({
  attribution,
}: {
  attribution: PullRequestAttribution;
}) {
  switch (attribution.type) {
    case 'seer':
      return <SeerAttributionAvatar />;
  }
}

function getPullRequestAuthor(pullRequest: LinkedPullRequest): PullRequestAuthor | null {
  if (!pullRequest.author || pullRequest.author.email?.endsWith('@localhost')) {
    return null;
  }

  return pullRequest.author;
}

function isSentryUserAuthor(author: PullRequestAuthor): author is User {
  return 'id' in author;
}

function PullRequestAuthorAvatar({author}: {author: PullRequestAuthor}) {
  const name = author.name || author.email;
  if (!name) {
    return null;
  }

  const label = t('Pull request author: %s', name);

  return (
    <Flex as="span" aria-label={label} display="inline-flex" role="img" title={label}>
      {isSentryUserAuthor(author) ? (
        <UserAvatar hasTooltip size={18} tooltip={label} user={author} />
      ) : (
        <Avatar
          hasTooltip
          identifier={author.email || author.name || name}
          name={name}
          round
          size={18}
          tooltip={label}
          type="letter_avatar"
        />
      )}
    </Flex>
  );
}

function SeerAttributionAvatar() {
  const label = t('Pull request created by Seer');

  return (
    <Tooltip title={label} skipWrapper>
      <Flex
        as="span"
        align="center"
        aria-label={label}
        border="primary"
        display="inline-flex"
        height="18px"
        justify="center"
        radius="full"
        role="img"
        title={label}
        width="18px"
      >
        <IconSeer aria-hidden size="xs" />
      </Flex>
    </Tooltip>
  );
}

export function useLinkedPullRequests({group}: {group: Group}) {
  const organization = useOrganization();

  return useQuery(
    apiOptions.as<LinkedPullRequestsResponse>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/pull-requests/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId: group.id},
        staleTime: 30_000,
      }
    )
  );
}

export function LinkedPullRequests({group, showEmptyState}: LinkedPullRequestsProps) {
  const {data, isError, isPending} = useLinkedPullRequests({group});
  const activityPullRequestIds = getLinkedPullRequestActivityIds(group);

  if (isError) {
    return null;
  }

  if (isPending && activityPullRequestIds.size > 0) {
    return <Placeholder height="40px" />;
  }

  if (data?.pullRequests.length === 0) {
    return showEmptyState ? (
      <EmptyLinksText variant="muted">
        {t('No linked issues or pull requests')}
      </EmptyLinksText>
    ) : null;
  }

  if (!data?.pullRequests.length) {
    return null;
  }

  return (
    <Stack
      as="ul"
      aria-label={t('Linked pull requests')}
      border="primary"
      radius="md"
      overflow="hidden"
      margin="0"
      padding="0"
    >
      {data.pullRequests.map((pullRequest, index) => (
        <Container
          as="li"
          key={`${pullRequest.repository.id}:${pullRequest.id}`}
          borderTop={index === 0 ? undefined : 'primary'}
          style={{listStyle: 'none'}}
        >
          <LinkedPullRequestRow group={group} pullRequest={pullRequest} />
        </Container>
      ))}
    </Stack>
  );
}

const PullRequestRow = styled(ExternalLink)`
  display: block;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const EmptyLinksText = styled(Text)`
  margin: 0;
`;

const PullRequestTitle = styled('span')`
  align-items: center;
  display: flex;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;
