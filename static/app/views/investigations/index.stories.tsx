import {Fragment, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';
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
    titleGeneration: {status: 'running'},
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
  const organization = useOrganization();
  const listUrl = `/organizations/${organization.slug}/investigations/`;
  const apiResponses = useMemo(
    () => [{url: listUrl, response: {body: items}}],
    [items, listUrl]
  );

  return (
    <InvestigationsStoryProviders
      features={features}
      openMembership={openMembership}
      apiResponses={apiResponses}
      seed={(queryClient, org) => {
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
