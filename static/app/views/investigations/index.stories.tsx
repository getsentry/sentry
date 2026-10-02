import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import InvestigationsView, {InvestigationsPage} from 'sentry/views/investigations';
import {InvestigationListItemFixture} from 'sentry/views/investigations/fixtures';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

import {InvestigationFixtureApi} from './__stories__/investigationFixtureApi';

const realisticInvestigations = [
  InvestigationListItemFixture({
    id: 'checkout-latency',
    title: 'Checkout latency after payments-api 2026.08.18 deploy',
    sourceType: 'metric_open_period',
    blockCount: 7,
    isFavorited: true,
    dateCreated: '2026-08-18T16:02:14Z',
    dateUpdated: '2026-08-18T16:19:42Z',
    summary: 'Connection acquisition is delaying checkout requests',
    summaryDescription:
      'The p95 increase begins four minutes after the deploy and appears in every production region.',
  }),
  InvestigationListItemFixture({
    id: 'mobile-crash-free',
    title: 'iOS crash-free sessions dropped in release 8.42.0',
    sourceType: 'metric_open_period',
    blockCount: 5,
    dateCreated: '2026-08-18T13:41:07Z',
    dateUpdated: '2026-08-18T14:05:18Z',
    summary: 'A startup crash is isolated to iOS 18.6',
    summaryDescription:
      'The affected stack enters SessionCoordinator before remote configuration has loaded.',
  }),
  InvestigationListItemFixture({
    id: 'invoice-timeouts',
    title: 'Invoice PDF timeouts in eu-west-1',
    blockCount: 4,
    dateCreated: '2026-08-17T19:27:31Z',
    dateUpdated: '2026-08-18T09:12:02Z',
  }),
  InvestigationListItemFixture({
    id: 'consumer-lag',
    title: 'Billing events consumer lag during hourly reconciliation',
    blockCount: 9,
    isFavorited: true,
    dateCreated: '2026-08-16T22:11:05Z',
    dateUpdated: '2026-08-17T00:04:55Z',
  }),
  InvestigationListItemFixture({
    id: 'generated-title',
    title: 'Untitled investigation',
    sourceType: 'metric_open_period',
    blockCount: 2,
    dateCreated: '2026-08-27T15:31:00Z',
    dateUpdated: '2026-08-27T15:31:22Z',
    titleGeneration: {status: 'running'},
  }),
];

export default Storybook.story('Investigations — List', story => {
  story('Populated and interactive', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigations-list"
      list={realisticInvestigations}
      pageLinks={getPaginationPageLink({numRows: 14, pageSize: 5, offset: 0})}
    >
      <Container minHeight="520px" border="primary" radius="md" overflow="hidden">
        <InvestigationsPage />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Empty and search results', () => (
    <InvestigationFixtureApi organizationSlug="storybook-investigations-empty" list={[]}>
      <Container minHeight="420px" border="primary" radius="md" overflow="hidden">
        <InvestigationsPage />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Loading', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigations-list-loading"
      mode="loading"
    >
      <Container minHeight="420px" border="primary" radius="md" overflow="hidden">
        <InvestigationsPage />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Error', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigations-list-error"
      mode="error"
    >
      <Container minHeight="420px" border="primary" radius="md" overflow="hidden">
        <InvestigationsPage />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Feature unavailable', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigations-disabled"
      featureEnabled={false}
    >
      <Container minHeight="320px" border="primary" radius="md" overflow="hidden">
        <InvestigationsView />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Closed membership', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigations-closed-membership"
      openMembership={false}
    >
      <Container minHeight="240px" border="primary" radius="md" overflow="hidden">
        <InvestigationsView />
      </Container>
    </InvestigationFixtureApi>
  ));
});
