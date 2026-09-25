import {AnnotationFixture} from 'sentry-fixture/annotation';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  act,
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {useDroppedDataDrawer} from 'sentry/components/droppedData/useDroppedDataDrawer';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

function mockDroppedData(eventCount: number, statsPeriod: string) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-timeseries/`,
    match: [MockApiClient.matchQuery({statsPeriod})],
    body: {
      timeSeries: [],
      meta: {
        droppedAnnotations: [AnnotationFixture({eventCount})],
        acceptedAnnotations: [AnnotationFixture({outcome: 'accepted', eventCount: 90})],
      },
    },
  });
}

function DroppedDataTrigger() {
  const openDroppedDataDrawer = useDroppedDataDrawer(DiscoverDatasets.SPANS);
  return <button onClick={openDroppedDataDrawer}>Open dropped data</button>;
}

describe('useDroppedDataDrawer', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {period: '14d', start: null, end: null, utc: false},
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('stays open and refreshes when zooming changes the time range', async () => {
    mockDroppedData(10, '14d');
    mockDroppedData(3, '1h');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    act(() => {
      router.navigate('/explore/traces/?statsPeriod=1h');
      PageFiltersStore.updateDateTime({period: '1h', start: null, end: null, utc: false});
    });

    expect(await screen.findByText('3 Dropped Events')).toBeInTheDocument();
  });

  it('closes when navigating to another page', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    router.navigate('/issues/');
    await waitForDrawerToHide('Dropped Data');
  });
});
