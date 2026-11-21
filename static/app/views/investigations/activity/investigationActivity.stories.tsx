import {Container, Stack} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {
  commentStoryAuthors,
  commentedInvestigation,
  commentedInvestigationComments,
} from 'sentry/views/investigations/__stories__/commentStoryFixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {
  InvestigationCommentFixture,
  InvestigationDetailFixture,
  InvestigationActionRequestFixture,
} from 'sentry/views/investigations/fixtures';

import {InvestigationActivity} from './investigationActivity';

const uncommentedInvestigation = InvestigationDetailFixture({
  id: 'uncommented-investigation',
  dateCreated: '2026-08-27T14:08:00Z',
  blocks: [],
});
const startedInvestigations = {
  person: InvestigationDetailFixture({
    id: 'started-by-person',
    dateCreated: '2026-08-27T14:08:00Z',
    blocks: [],
    trigger: {type: 'user', user: commentStoryAuthors.GRACE},
  }),
  automation: InvestigationDetailFixture({
    id: 'started-by-automation',
    dateCreated: '2026-08-27T14:08:00Z',
    blocks: [],
    createdBy: null,
    trigger: {
      type: 'automation',
      automation: {id: '5', name: null, strategy: 'breached_metric_investigation'},
      runId: '42',
    },
  }),
  issue: InvestigationDetailFixture({
    id: 'started-from-issue',
    dateCreated: '2026-08-27T14:08:00Z',
    blocks: [],
    createdBy: null,
    sourceType: 'metric_open_period',
    source: {
      type: 'metric_open_period',
      ref: {groupId: '123', openPeriodId: '456'},
      revision: 1,
      snapshot: {
        project: {slug: 'checkout'},
        monitor: {
          id: '789',
          name: 'Checkout p95 latency',
          aggregate: 'p95(span.duration)',
          query: '',
          environment: null,
          comparisonDeltaSeconds: null,
          conditions: [],
        },
      },
    },
  }),
};
const appliedInvestigation = {
  ...commentedInvestigation,
  actionRequests: [
    InvestigationActionRequestFixture({
      state: 'applied',
      canApply: false,
      cannotApplyReason: 'not_suggested',
      appliedBy: commentStoryAuthors.GRACE,
      appliedDetails: {
        detectorId: '789',
        detectorName: 'Cart p95 latency',
        fields: ['timeWindowSeconds'],
      },
      dateApplied: '2026-08-27T15:00:00Z',
    }),
  ],
};
const archivedInvestigation = {...commentedInvestigation, status: 'archived' as const};
const ownComments = [
  InvestigationCommentFixture({
    id: 'own-edited',
    author: commentStoryAuthors.ADA,
    body: 'Rolling back the autoscaling change. Billing on-call confirmed the timing.',
    dateCreated: '2026-08-27T15:30:00Z',
    dateUpdated: '2026-08-27T15:36:00Z',
  }),
  InvestigationCommentFixture({
    id: 'own-block',
    blockId: 'commented-query',
    author: commentStoryAuthors.ADA,
    body: 'p95 jumps right at 13:40, which lines up with the worker autoscaling change.',
    dateCreated: '2026-08-27T15:05:00Z',
    dateUpdated: '2026-08-27T15:05:00Z',
  }),
  InvestigationCommentFixture({
    id: 'someone-elses',
    author: commentStoryAuthors.GRACE,
    body: 'Pulled in the billing on-call.',
    dateCreated: '2026-08-27T14:50:00Z',
    dateUpdated: '2026-08-27T14:50:00Z',
  }),
];

export default Storybook.story('Investigations — Activity', story => {
  story('Page and block comments', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: commentedInvestigationComments}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={commentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('No comments yet', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-empty"
      details={[uncommentedInvestigation]}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('What started the investigation', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-started"
      details={Object.values(startedInvestigations)}
    >
      <Stack maxWidth="960px" gap="2xl">
        {Object.values(startedInvestigations).map(investigation => (
          <InvestigationActivity key={investigation.id} investigation={investigation} />
        ))}
      </Stack>
    </InvestigationFixtureApi>
  ));

  story('Your comments (as Ada Lovelace)', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-own"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: ownComments}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={commentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Applied action request', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-applied"
      details={[appliedInvestigation]}
      comments={{[appliedInvestigation.id]: commentedInvestigationComments}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={appliedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Archived investigation', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-archived"
      details={[archivedInvestigation]}
      comments={{[archivedInvestigation.id]: commentedInvestigationComments.slice(0, 2)}}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={archivedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('More than 100 comments', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-older"
      details={[commentedInvestigation]}
      comments={{[commentedInvestigation.id]: commentedInvestigationComments.slice(0, 2)}}
      commentPageLinks={{
        [commentedInvestigation.id]:
          '<link>; rel="previous"; results="false"; cursor="0:0:1", <link>; rel="next"; results="true"; cursor="0:100:0"',
      }}
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={commentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Loading', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-loading"
      mode="loading"
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Error', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-activity-error"
      mode="error"
    >
      <Container maxWidth="960px">
        <InvestigationActivity investigation={uncommentedInvestigation} />
      </Container>
    </InvestigationFixtureApi>
  ));
});
