import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import InvestigationsView from 'sentry/views/investigations';
import {InvestigationListItemFixture} from 'sentry/views/investigations/fixtures';
import {
  InvestigationsStoryProviders,
  seedInvestigationList,
} from 'sentry/views/investigations/storyHelpers';

function ListExample({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

const DEFAULT_LIST_ITEMS = [
  InvestigationListItemFixture({
    id: '1',
    title: 'Database latency investigation',
    isFavorited: true,
    blockCount: 4,
  }),
  InvestigationListItemFixture({
    id: '2',
    title: 'Checkout error rate spike',
    sourceType: 'metric_open_period',
    blockCount: 6,
    summary: 'Errors rose across releases',
    summaryDescription: 'All active releases increased together.',
  }),
  InvestigationListItemFixture({
    id: '3',
    title: 'Untitled investigation',
    // Keep titleGeneration idle so list stories do not poll and clobber sibling
    // fixtures through the shared story API client.
    titleGeneration: {status: null},
    blockCount: 0,
  }),
];

function ListStory({
  items = DEFAULT_LIST_ITEMS,
  features,
  openMembership,
}: {
  features?: string[];
  items?: Array<ReturnType<typeof InvestigationListItemFixture>>;
  openMembership?: boolean;
}) {
  return (
    <InvestigationsStoryProviders
      features={features}
      openMembership={openMembership}
      seed={(queryClient, org) => {
        // Per-story QueryClient fixtures only — avoid a shared list API mock so
        // populated/empty examples on one scraps page stay independent.
        seedInvestigationList(queryClient, org.slug, items);
      }}
    >
      <InvestigationsView />
    </InvestigationsStoryProviders>
  );
}

export default Storybook.story('Investigations List', story => {
  story('Populated list', () => (
    <Fragment>
      <p>
        Explore list with favorited, breached-metric, and title-generating rows. API
        fixtures keep the table offline for visual review.
      </p>
      <ListStory />
    </Fragment>
  ));

  story('Empty list', () => (
    <ListExample label="No matching investigations">
      <ListStory items={[]} />
    </ListExample>
  ));

  story('Feature disabled', () => (
    <ListExample label="organizations:investigations missing">
      <ListStory features={[]} items={[]} />
    </ListExample>
  ));

  story('Closed membership', () => (
    <ListExample label="openMembership=false">
      <ListStory openMembership={false} items={[]} />
    </ListExample>
  ));
});
