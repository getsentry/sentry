import {Fragment, type ComponentProps} from 'react';

import * as Storybook from 'sentry/stories';
import {RepositoryStatus} from 'sentry/types/integrations';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {CodeReviewOverviewSection} from 'sentry/views/settings/seer/overview/codeReviewOverviewSection';

type Props = ComponentProps<typeof CodeReviewOverviewSection>;

function makeRepo(
  id: string,
  name: string,
  enabledCodeReview: boolean
): RepositoryWithSettings {
  return {
    id,
    name,
    externalId: id,
    externalSlug: name,
    integrationId: '1',
    url: `https://github.com/${name}`,
    status: RepositoryStatus.ACTIVE,
    dateCreated: '',
    provider: {id: 'integrations:github', name: 'GitHub'},
    settings: {
      enabledCodeReview,
      codeReviewTriggers: ['on_ready_for_review', 'on_new_commit'],
    },
  };
}

const ALL_REPOS: RepositoryWithSettings[] = [
  makeRepo('1', 'my-org/frontend', false),
  makeRepo('2', 'my-org/backend', false),
  makeRepo('3', 'my-org/infra', false),
  makeRepo('4', 'my-org/mobile', false),
  makeRepo('5', 'my-org/data-pipeline', false),
];

const BASE_ORG = {
  slug: 'my-org',
  autoEnableCodeReview: true,
  defaultCodeReviewTriggers: ['on_ready_for_review', 'on_new_commit'],
  access: ['org:read', 'org:write', 'org:admin', 'org:integrations'],
} as Organization;

const ORG = BASE_ORG;
const ORG_AUTO_OFF: Organization = {...BASE_ORG, autoEnableCodeReview: false};
const ORG_READONLY: Organization = {...BASE_ORG, access: ['org:read']};

function makeProps(
  seerRepos: RepositoryWithSettings[],
  reposWithCodeReview: RepositoryWithSettings[],
  orgOverride: Organization = ORG,
  isPending = false
): Props {
  return {
    isPending,
    data: {queryKey: ['repositories'] as any, seerRepos, reposWithCodeReview},
    refetch: () => Promise.resolve({} as any),
    canWrite: true,
    organization: orgOverride,
  } as Props;
}

export default Storybook.story('CodeReviewOverviewSection', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="CodeReviewOverviewSection" /> is the code review
        panel in the Seer settings overview page. It lets users enable or disable code
        review across all existing repositories at once and configure the default triggers
        (on push vs. on ready-for-review).
      </p>
      <p>
        The component derives its display from two lists: <code>seerRepos</code> (all
        Seer-compatible repos) and <code>reposWithCodeReview</code> (the subset that have
        code review enabled). The ratio between them drives the counter text and the
        enable/disable bulk-action button state. The{' '}
        <strong>Enable Code Review by Default</strong> toggle reflects{' '}
        <code>organization.autoEnableCodeReview</code> and flips the direction of the bulk
        action (enable remaining vs. disable all).
      </p>
    </Fragment>
  ));

  story('Loading', () => <CodeReviewOverviewSection {...makeProps([], [], ORG, true)} />);

  story('0 repos', () => <CodeReviewOverviewSection {...makeProps([], [])} />);

  story('1 repo / 0 enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS.slice(0, 1), [])} />
  ));

  story('1 repo / 1 enabled (all)', () => (
    <CodeReviewOverviewSection
      {...makeProps(ALL_REPOS.slice(0, 1), ALL_REPOS.slice(0, 1))}
    />
  ));

  story('N repos / 0 enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, [])} />
  ));

  story('N repos / 1 enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, ALL_REPOS.slice(0, 1))} />
  ));

  story('N repos / many enabled (not all)', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, ALL_REPOS.slice(0, 3))} />
  ));

  story('N repos / all enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, ALL_REPOS)} />
  ));

  story('Auto-enable off / 0 enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, [], ORG_AUTO_OFF)} />
  ));

  story('Auto-enable off / some enabled', () => (
    <CodeReviewOverviewSection
      {...makeProps(ALL_REPOS, ALL_REPOS.slice(0, 2), ORG_AUTO_OFF)}
    />
  ));

  story('Auto-enable off / all enabled', () => (
    <CodeReviewOverviewSection {...makeProps(ALL_REPOS, ALL_REPOS, ORG_AUTO_OFF)} />
  ));

  story('Read-only (no org:write)', () => (
    <CodeReviewOverviewSection
      {...makeProps(ALL_REPOS, ALL_REPOS.slice(0, 2), ORG_READONLY)}
    />
  ));
});
