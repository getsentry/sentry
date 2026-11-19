import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {useChartLayers} from './useChartLayers';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

describe('useChartLayers', () => {
  let droppedDataRequest: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    droppedDataRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: {
        droppedEvents: [OutcomeRowFixture({count: 10})],
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 90})],
        meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      },
    });
  });

  it('returns the dropped data band and its layer once the data loads', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useChartLayers({
          dataset: DiscoverDatasets.SPANS,
          interval: '1h',
          source: 'explore',
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.droppedData.band).toBeDefined());
    expect(result.current.layerControl?.layers).toEqual([
      expect.objectContaining({value: 'dropped-data', label: 'Dropped Spans'}),
    ]);
  });

  it.each(['explore', 'dashboards'] as const)(
    'toggles the dropped data band and tracks it with the %s source',
    async source => {
      const {result} = renderHookWithProviders(
        () => useChartLayers({dataset: DiscoverDatasets.SPANS, interval: '1h', source}),
        {organization}
      );

      await waitFor(() => expect(result.current.droppedData.band).toBeDefined());
      act(() => result.current.layerControl!.onChange('dropped-data', false));

      expect(result.current.droppedData.band).toBeUndefined();
      expect(result.current.layerControl?.layers[0]?.selected).toBe(false);
      expect(trackAnalytics).toHaveBeenCalledWith('explore.dropped_data.layer_toggled', {
        organization,
        dataset: DiscoverDatasets.SPANS,
        source,
        selected: false,
      });
    }
  );

  it('keeps the layer but draws no band when hidden', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useChartLayers({
          dataset: DiscoverDatasets.SPANS,
          interval: '1h',
          source: 'explore',
          hidden: true,
        }),
      {organization}
    );

    await waitFor(() => expect(result.current.layerControl).toBeDefined());
    expect(result.current.droppedData.band).toBeUndefined();
  });

  describe('releases', () => {
    const releasesOrganization = OrganizationFixture({
      features: ['explore-data-fidelity-annotations', 'timeseries-annotations'],
    });

    function renderReleasesHook(releases: Array<{date: string; version: string}>) {
      MockApiClient.addMockResponse({
        url: `/organizations/${releasesOrganization.slug}/releases/stats/`,
        body: releases,
      });

      return renderHookWithProviders(
        () =>
          useChartLayers({
            dataset: DiscoverDatasets.SPANS,
            interval: '1h',
            source: 'explore',
          }),
        {organization: releasesOrganization}
      );
    }

    it('toggles releases in the annotations band from the Releases layer', async () => {
      const {result} = renderReleasesHook([
        {date: '2026-11-03T12:00:00Z', version: 'ui@1.0.0'},
      ]);

      await waitFor(() =>
        expect(result.current.annotations).toEqual([
          {
            id: 'release:ui@1.0.0',
            kind: 'release',
            start: new Date('2026-11-03T12:00:00Z').getTime(),
            title: 'ui@1.0.0',
          },
        ])
      );
      act(() => result.current.layerControl!.onChange('releases', false));

      expect(result.current.annotations).toBeUndefined();
      expect(result.current.layerControl?.layers).toContainEqual(
        expect.objectContaining({value: 'releases', selected: false})
      );
      expect(trackAnalytics).toHaveBeenCalledWith('releases.bubbles_legend', {
        organization: releasesOrganization,
        selected: false,
      });
    });

    it('disables the Releases layer when the range has no releases', async () => {
      const {result} = renderReleasesHook([]);

      await waitFor(() =>
        expect(result.current.layerControl?.layers).toContainEqual({
          value: 'releases',
          label: 'Releases',
          selected: false,
          disabled: true,
          tooltip: 'No releases in this time range',
        })
      );
      expect(result.current.annotations).toBeUndefined();
    });
  });

  it('has no layers and requests nothing when disabled', () => {
    const {result} = renderHookWithProviders(
      () =>
        useChartLayers({
          dataset: DiscoverDatasets.SPANS,
          interval: '1h',
          source: 'explore',
          enabled: false,
        }),
      {organization}
    );

    expect(result.current.layerControl).toBeUndefined();
    expect(droppedDataRequest).not.toHaveBeenCalled();
  });
});
