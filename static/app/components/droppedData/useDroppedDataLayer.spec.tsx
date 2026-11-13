import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import type {OutcomeRow} from './types';
import {useDroppedDataLayer} from './useDroppedDataLayer';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

const droppedEvents = [OutcomeRowFixture({count: 10})];
const acceptedEvents = [OutcomeRowFixture({outcome: 'accepted', count: 90})];

function mockDroppedData(dropped: OutcomeRow[] = droppedEvents) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-dropped/`,
    body: {
      meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      droppedEvents: dropped,
      acceptedEvents,
    },
  });
}

describe('useDroppedDataLayer', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('returns the band, filter note, and layer control when data was dropped', async () => {
    mockDroppedData();

    const {result} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.band).toBeDefined());
    expect(result.current.band).toEqual({
      dataset: DiscoverDatasets.SPANS,
      droppedEvents,
      acceptedEvents,
      onClick: expect.any(Function),
    });
    expect(result.current.filterNote).toEqual({dataset: DiscoverDatasets.SPANS});
    expect(result.current.layerControl).toEqual({
      layers: [
        {
          value: 'dropped-data',
          label: 'Dropped Spans',
          selected: true,
          disabled: false,
          tooltip: undefined,
        },
      ],
      onChange: expect.any(Function),
    });
  });

  it('reports loading until the dropped data arrives', async () => {
    mockDroppedData();

    const {result} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.band).toBeDefined();
  });

  it('does not report loading when the band is hidden', () => {
    mockDroppedData();

    const {result} = renderHookWithProviders(
      () =>
        useDroppedDataLayer(
          {dataset: DiscoverDatasets.SPANS, interval: '1h'},
          {hidden: true}
        ),
      {organization}
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('removes the band and filter note when the layer is turned off', async () => {
    mockDroppedData();

    const {result} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.band).toBeDefined());
    act(() => result.current.layerControl!.onChange('dropped-data', false));

    expect(result.current.band).toBeUndefined();
    expect(result.current.filterNote).toBeUndefined();
    expect(result.current.layerControl!.layers).toEqual([
      expect.objectContaining({selected: false, disabled: false}),
    ]);
  });

  it('opens the drawer from the band', async () => {
    mockDroppedData();

    const {result, router} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.band).toBeDefined());
    act(() => result.current.band!.onClick!());

    await waitFor(() => expect(router.location.query.droppedData).toBe('spans'));
  });

  it('keeps the layer control but hides the band and filter note when hidden', async () => {
    mockDroppedData();

    const {result} = renderHookWithProviders(
      () =>
        useDroppedDataLayer(
          {dataset: DiscoverDatasets.SPANS, interval: '1h'},
          {hidden: true}
        ),
      {organization}
    );

    await waitFor(() => expect(result.current.layerControl).toBeDefined());
    expect(result.current.layerControl!.layers).toEqual([
      expect.objectContaining({selected: true, disabled: false}),
    ]);
    expect(result.current.band).toBeUndefined();
    expect(result.current.filterNote).toBeUndefined();
  });

  it('disables the layer control when nothing significant was dropped', async () => {
    mockDroppedData([]);

    const {result} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.SPANS, interval: '1h'}),
      {organization}
    );

    await waitFor(() => expect(result.current.layerControl).toBeDefined());
    expect(result.current.layerControl!.layers).toEqual([
      {
        value: 'dropped-data',
        label: 'Dropped Spans',
        selected: false,
        disabled: true,
        tooltip: 'No significant dropped spans in this time range',
      },
    ]);
    expect(result.current.band).toBeUndefined();
    expect(result.current.filterNote).toBeUndefined();
  });

  it('does not request dropped data when disabled', () => {
    const request = mockDroppedData();

    const {result} = renderHookWithProviders(
      () =>
        useDroppedDataLayer(
          {dataset: DiscoverDatasets.SPANS, interval: '1h'},
          {enabled: false}
        ),
      {organization}
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      band: undefined,
      filterNote: undefined,
      isLoading: false,
      layerControl: undefined,
    });
  });

  it('does not request dropped data for unsupported datasets', () => {
    const request = mockDroppedData();

    const {result} = renderHookWithProviders(
      () => useDroppedDataLayer({dataset: DiscoverDatasets.TRANSACTIONS, interval: '1h'}),
      {organization}
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      band: undefined,
      filterNote: undefined,
      isLoading: false,
      layerControl: undefined,
    });
  });
});
