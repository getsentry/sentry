import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {IconMerge, IconPullRequest, IconPullRequestClosed} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

const LINKED_PULL_REQUESTS_FEATURE = 'issue-details-linked-pull-requests';

type LinkedPullRequestStatus = 'closed' | 'draft' | 'merged' | 'open' | 'unknown';

type LinkedPullRequest = PullRequest & {
  dateLinked: string;
  status: LinkedPullRequestStatus;
};

type LinkedPullRequestsResponse = {
  pullRequests: LinkedPullRequest[];
};

interface LinkedPullRequestsProps {
  group: Group;
  showEmptyState?: boolean;
}

const STATUS_ICONS = {
  closed: IconPullRequestClosed,
  draft: IconPullRequest,
  merged: IconMerge,
  open: IconPullRequest,
  unknown: IconPullRequest,
} satisfies Record<LinkedPullRequestStatus, React.ComponentType<SVGIconProps>>;

function getStatusLabel(status: LinkedPullRequestStatus) {
  switch (status) {
    case 'closed':
      return t('Closed');
    case 'draft':
      return t('Draft');
    case 'merged':
      return t('Merged');
    case 'open':
      return t('Open');
    case 'unknown':
      return t('Unknown status');
    default:
      return status satisfies never;
  }
}

function getStatusBadgeVariant(status: LinkedPullRequestStatus) {
  switch (status) {
    case 'closed':
      return 'danger';
    case 'draft':
      return 'muted';
    case 'merged':
      return 'info';
    case 'open':
      return 'success';
    case 'unknown':
      return 'muted';
    default:
      return status satisfies never;
  }
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
  const statusLabel = getStatusLabel(pullRequest.status);
  const pullRequestLabel = t('#%s', pullRequest.id);
  const StatusIcon = STATUS_ICONS[pullRequest.status];

  return (
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
          pull_request_id: pullRequest.id,
          pull_request_status: pullRequest.status,
          repository_id: pullRequest.repository.id,
          repository_provider: pullRequest.repository.provider.id,
          ...getAnalyticsDataForGroup(group),
        })
      }
    >
      <Grid columns="max-content minmax(0, 1fr)" gap="sm" padding="sm">
        <Flex as="span" aria-hidden align="start" paddingTop="2xs">
          <RepoProviderIcon
            provider={pullRequest.repository.provider.id}
            size="sm"
            variant="muted"
          />
        </Flex>
        <Flex direction="column" gap="2xs" minWidth={0}>
          <Tooltip
            title={
              <Text as="span" align="left" wordBreak="break-word">
                {title}
              </Text>
            }
            maxWidth={275}
            skipWrapper
          >
            <PullRequestTitle>
              <Text as="span" bold textWrap="nowrap">
                {pullRequestLabel}
              </Text>
              <Text as="span" ellipsis>
                {pullRequest.repository.name}
              </Text>
            </PullRequestTitle>
          </Tooltip>
          <Flex align="center">
            <StatusBadge
              data-test-id={`linked-pull-request-status-${pullRequest.status}`}
              variant={getStatusBadgeVariant(pullRequest.status)}
            >
              <StatusIcon aria-hidden size="xs" />
              {statusLabel}
            </StatusBadge>
          </Flex>
        </Flex>
      </Grid>
    </PullRequestRow>
  );
}

export function useLinkedPullRequests({group}: {group: Group}) {
  const organization = useOrganization();
  const hasFeature = organization.features.includes(LINKED_PULL_REQUESTS_FEATURE);

  return useQuery(
    apiOptions.as<LinkedPullRequestsResponse>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/pull-requests/',
      {
        path: hasFeature
          ? {organizationIdOrSlug: organization.slug, issueId: group.id}
          : skipToken,
        staleTime: 30_000,
      }
    )
  );
}

export function LinkedPullRequests({group, showEmptyState}: LinkedPullRequestsProps) {
  const organization = useOrganization();
  const hasFeature = organization.features.includes(LINKED_PULL_REQUESTS_FEATURE);
  const {data, isError} = useLinkedPullRequests({group});

  if (!hasFeature || isError) {
    return null;
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
    <Flex
      as="ul"
      aria-label={t('Linked pull requests')}
      direction="column"
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
    </Flex>
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

const StatusBadge = styled(Badge)`
  gap: ${p => p.theme.space['2xs']};
`;

const PullRequestTitle = styled('span')`
  align-items: center;
  display: flex;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  overflow: hidden;
  width: 100%;
`;
