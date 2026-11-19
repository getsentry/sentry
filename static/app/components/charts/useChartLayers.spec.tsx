import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {RawFlag} from 'sentry/components/featureFlags/utils';
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

  describe('annotations', () => {
    const annotationsOrganization = OrganizationFixture({
      features: ['explore-data-fidelity-annotations', 'timeseries-annotations'],
    });

    const release = {date: '2026-11-03T12:00:00Z', version: 'ui@1.0.0'};
    const flagChange: RawFlag = {
      id: 1,
      action: 'updated',
      createdAt: '2026-11-03T13:00:00Z',
      createdBy: 'user@example.com',
      createdByType: 'email',
      flag: 'new-checkout',
      tags: {},
    };

    const releaseAnnotation = {
      id: 'release:ui@1.0.0',
      kind: 'release',
      start: new Date('2026-11-03T12:00:00Z').getTime(),
      title: 'ui@1.0.0',
    };
    const flagAnnotation = {
      id: 'flag:1',
      kind: 'flag',
      start: new Date('2026-11-03T13:00:00Z').getTime(),
      title: 'new-checkout',
    };

    let flagLogRequest: jest.Mock;

    function renderAnnotationsHook({
      releases,
      flags,
    }: {
      flags: RawFlag[];
      releases: Array<{date: string; version: string}>;
    }) {
      MockApiClient.addMockResponse({
        url: `/organizations/${annotationsOrganization.slug}/releases/stats/`,
        body: releases,
      });
      flagLogRequest = MockApiClient.addMockResponse({
        url: `/organizations/${annotationsOrganization.slug}/flags/logs/`,
        body: {data: flags},
      });

      return renderHookWithProviders(
        () =>
          useChartLayers({
            dataset: DiscoverDatasets.SPANS,
            interval: '1h',
            source: 'explore',
          }),
        {organization: annotationsOrganization}
      );
    }

    it('feeds releases and flag changes into the annotations band', async () => {
      const {result} = renderAnnotationsHook({releases: [release], flags: [flagChange]});

      await waitFor(() =>
        expect(result.current.annotations).toEqual([releaseAnnotation, flagAnnotation])
      );
      expect(result.current.layerControl?.layers).toEqual([
        expect.objectContaining({value: 'dropped-data'}),
        expect.objectContaining({value: 'releases', selected: true}),
        expect.objectContaining({value: 'flags', label: 'Flags', selected: true}),
      ]);
    });

    it('requests the flag log in a stable order so its pages line up', async () => {
      renderAnnotationsHook({releases: [], flags: [flagChange]});

      await waitFor(() =>
        expect(flagLogRequest).toHaveBeenCalledWith(
          `/organizations/${annotationsOrganization.slug}/flags/logs/`,
          expect.objectContaining({
            query: expect.objectContaining({sort: 'created_at'}),
          })
        )
      );
    });

    it('toggles releases in the annotations band from the Releases layer', async () => {
      const {result} = renderAnnotationsHook({releases: [release], flags: []});

      await waitFor(() =>
        expect(result.current.annotations).toEqual([releaseAnnotation])
      );
      act(() => result.current.layerControl!.onChange('releases', false));

      expect(result.current.annotations).toBeUndefined();
      expect(result.current.layerControl?.layers).toContainEqual(
        expect.objectContaining({value: 'releases', selected: false})
      );
      expect(trackAnalytics).toHaveBeenCalledWith('releases.bubbles_legend', {
        organization: annotationsOrganization,
        selected: false,
      });
    });

    it('toggles flag changes in the annotations band from the Flags layer', async () => {
      const {result} = renderAnnotationsHook({releases: [release], flags: [flagChange]});

      await waitFor(() =>
        expect(result.current.annotations).toEqual([releaseAnnotation, flagAnnotation])
      );
      act(() => result.current.layerControl!.onChange('flags', false));

      expect(result.current.annotations).toEqual([releaseAnnotation]);
      expect(result.current.layerControl?.layers).toContainEqual(
        expect.objectContaining({value: 'flags', selected: false})
      );
      expect(trackAnalytics).toHaveBeenCalledWith('flags.layer_toggled', {
        organization: annotationsOrganization,
        selected: false,
      });
    });

    it('disables the Releases and Flags layers when the range has neither', async () => {
      const {result} = renderAnnotationsHook({releases: [], flags: []});

      await waitFor(() =>
        expect(result.current.layerControl?.layers).toEqual(
          expect.arrayContaining([
            {
              value: 'releases',
              label: 'Releases',
              selected: false,
              disabled: true,
              tooltip: 'No releases in this time range',
            },
            {
              value: 'flags',
              label: 'Flags',
              selected: false,
              disabled: true,
              tooltip: 'No flag changes in this time range',
            },
          ])
        )
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
