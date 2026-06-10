import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {
  IconMerge,
  IconPullRequest,
  IconPullRequestClosed,
  IconRepository,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

type StatusIconConfig = {
  Icon: React.ComponentType<SVGIconProps>;
  variant: SVGIconProps['variant'];
};

const STATUS_ICON_CONFIG = {
  closed: {Icon: IconPullRequestClosed, variant: 'danger'},
  draft: {Icon: IconPullRequest, variant: 'muted'},
  merged: {Icon: IconMerge, variant: 'accent'},
  open: {Icon: IconPullRequest, variant: 'success'},
  unknown: {Icon: IconPullRequest, variant: 'muted'},
} satisfies Record<LinkedPullRequestStatus, StatusIconConfig>;

function getStatusIcon(status: LinkedPullRequestStatus) {
  const {Icon, variant} = STATUS_ICON_CONFIG[status];
  return (
    <Icon
      aria-hidden
      data-test-id={`linked-pull-request-status-${status}`}
      size="xs"
      variant={variant}
    />
  );
}

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

function LinkedPullRequestRow({pullRequest}: {pullRequest: LinkedPullRequest}) {
  const title = pullRequest.title ?? t('Pull request #%s', pullRequest.id);
  const statusLabel = getStatusLabel(pullRequest.status);

  return (
    <PullRequestRow
      aria-label={t(
        '%s, pull request #%s, %s in %s',
        title,
        pullRequest.id,
        statusLabel,
        pullRequest.repository.name
      )}
      href={pullRequest.externalUrl}
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
          <PullRequestTitle>{title}</PullRequestTitle>
          <Flex align="center" gap="sm">
            <Flex as="span" align="center" gap="xs" minWidth={0}>
              {getStatusIcon(pullRequest.status)}
              <Text as="span" textWrap="nowrap" variant="muted">
                #{pullRequest.id}
              </Text>
            </Flex>
            <Flex as="span" align="center" gap="xs" minWidth={0}>
              <RepositoryIcon size="xs" variant="muted" />
              <Text
                as="span"
                ellipsis
                title={pullRequest.repository.name}
                variant="muted"
              >
                {pullRequest.repository.name}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Grid>
    </PullRequestRow>
  );
}

export function LinkedPullRequests({group, showEmptyState}: LinkedPullRequestsProps) {
  const organization = useOrganization();
  const hasFeature = organization.features.includes(LINKED_PULL_REQUESTS_FEATURE);

  const {data, isError} = useQuery(
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

  if (!hasFeature || isError) {
    return null;
  }

  if (data?.pullRequests.length === 0) {
    return showEmptyState ? (
      <EmptyLinksText variant="muted">{t('No external links yet')}</EmptyLinksText>
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
          <LinkedPullRequestRow pullRequest={pullRequest} />
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

const RepositoryIcon = styled(IconRepository)`
  transform: translateY(1px);
`;

const PullRequestTitle = styled('span')`
  display: block;
  overflow: hidden;
  width: 100%;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-ligatures: no-common-ligatures;
  font-feature-settings: 'liga' 0;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
