import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconReleases} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {ProgressState} from 'sentry/types/group';
import type {Commit, PullRequest, Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {StatusBannerFrame} from 'sentry/views/issueDetails/actions/statusBanner';
import {CommitChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/commitChip';
import {InlineChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/inlineChip';
import {PullRequestChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/pullRequestChip';

const repository: Repository = {
  dateCreated: '2025-01-01T00:00:00Z',
  externalId: 'example/repository',
  externalSlug: 'example/repository',
  id: '1',
  integrationId: '1',
  name: 'example/repository',
  provider: {id: 'integrations:github', name: 'GitHub'},
  status: RepositoryStatus.ACTIVE,
  url: 'https://github.com/example/repository',
};

const pullRequest: PullRequest = {
  dateCreated: '2025-01-01T00:00:00Z',
  externalUrl: 'https://github.com/example/repository/pull/1234',
  id: '1234',
  message: null,
  repository,
  title: 'Fix example issue',
};

const commit: Commit = {
  dateCreated: '2025-01-01T00:00:00Z',
  id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
  message: 'Fix example issue',
  releases: [],
  repository,
};

export default Storybook.story('Resolution Banners', story => {
  story('Resolved', () => (
    <Stack gap="xl">
      <BannerExample label="Resolved in a release">
        <Banner>
          David Cramer resolved in <ReleaseChip>1.2.3</ReleaseChip>
        </Banner>
      </BannerExample>
      <BannerExample label="Resolved via a pull request in a release">
        <Banner>
          <PullRequestReleaseReason />
        </Banner>
      </BannerExample>
      <BannerExample label="Resolved starting with a later release">
        <Banner>
          David Cramer resolved starting with a release after{' '}
          <ReleaseChip>1.0.0</ReleaseChip>
        </Banner>
      </BannerExample>
      <BannerExample label="Set to resolve in the upcoming release">
        <Banner>David Cramer set this to resolve in the upcoming release</Banner>
      </BannerExample>
    </Stack>
  ));

  story('Archived', () => (
    <Stack gap="xl">
      <BannerExample label="Archived forever">
        <ArchivedBanner>forever</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until escalating">
        <ArchivedBanner>until it escalates</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until an event threshold">
        <ArchivedBanner>until 50 events occur within 10 minutes</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until a user threshold">
        <ArchivedBanner>until 50 users are affected within 10 minutes</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until a date">
        <ArchivedBanner>until Jan 1, 2027</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until additional events occur">
        <ArchivedBanner>until 50 more events occur</ArchivedBanner>
      </BannerExample>
      <BannerExample label="Archived until additional users are affected">
        <ArchivedBanner>until 50 more users are affected</ArchivedBanner>
      </BannerExample>
    </Stack>
  ));

  story('Deprecated', () => (
    <BannerExample label="Resolved via a commit">
      <Banner>
        David Cramer resolved via <CommitChip commit={commit} />
      </Banner>
    </BannerExample>
  ));
});

function BannerExample({children, label}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function Banner({
  children,
  status = 'resolved',
}: {
  children: React.ReactNode;
  status?: 'archived' | 'resolved';
}) {
  const isArchived = status === 'archived';

  return (
    <StatusBannerFrame
      markerLabel={isArchived ? 'Archived' : undefined}
      markerState={isArchived ? ProgressState.ASSIGNED : ProgressState.FIX_APPLIED}
      title={isArchived ? 'Archived' : 'Resolved'}
    >
      {children}
    </StatusBannerFrame>
  );
}

function ArchivedBanner({children}: {children: React.ReactNode}) {
  return <Banner status="archived">David Cramer archived {children}</Banner>;
}

function PullRequestReleaseReason() {
  return (
    <Fragment>
      David Cramer resolved via <PullRequestChip pullRequest={pullRequest} /> released in{' '}
      <ReleaseChip>1.2.3</ReleaseChip>
    </Fragment>
  );
}

function ReleaseChip({children}: {children: React.ReactNode}) {
  return (
    <InlineChip variant="constrained">
      <IconReleases size="xs" />
      {children}
    </InlineChip>
  );
}
