import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import type {TimeseriesAnnotation} from './annotations/timeseriesAnnotation';
import type {AnnotationItem} from './annotations/types';
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
    expect(result.current.showConfidence).toBe(false);
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
      features: [
        'explore-data-fidelity-annotations',
        'timeseries-annotations',
        'timeseries-annotations-usecase-filter-change',
        'timeseries-annotations-usecase-feature-flag-change',
      ],
    });

    const release = {date: '2026-11-03T12:00:00Z', version: 'ui@1.0.0'};
    const flagChange: TimeseriesAnnotation = {
      id: '1',
      organizationId: '1',
      projectId: null,
      environmentId: null,
      startTimestamp: '2026-11-03T13:00:00Z',
      endTimestamp: null,
      intervalType: 'point',
      annotationType: 'feature_flag_change',
      scope: 'global',
      severity: 'low',
      pinned: false,
      description: "Feature flag 'new-checkout' updated via LaunchDarkly",
      tags: {flag: 'new-checkout', action: 'updated', provider: 'launchdarkly'},
      createdBy: null,
      createdByLabel: 'feature-flag-webhook',
      dateAdded: '2026-11-03T13:00:00Z',
      dateUpdated: '2026-11-03T13:00:00Z',
    };

    const releaseAnnotation: AnnotationItem = {
      id: 'release:ui@1.0.0',
      kind: 'release',
      start: new Date('2026-11-03T12:00:00Z').getTime(),
      title: 'ui@1.0.0',
    };
    const flagAnnotation: AnnotationItem = {
      id: 'flag:1',
      kind: 'flag',
      start: new Date('2026-11-03T13:00:00Z').getTime(),
      title: 'new-checkout',
      action: 'updated',
    };

    const change: TimeseriesAnnotation = {
      id: '7',
      organizationId: '1',
      projectId: null,
      environmentId: null,
      startTimestamp: '2026-11-03T14:00:00Z',
      endTimestamp: null,
      intervalType: 'range',
      annotationType: 'inbound_filter_change',
      scope: 'global',
      severity: 'high',
      pinned: true,
      description: 'Ingestion outage',
      tags: null,
      createdBy: null,
      createdByLabel: 'statuspage',
      dateAdded: '2026-11-03T14:00:00Z',
      dateUpdated: '2026-11-03T14:00:00Z',
    };
    const changeAnnotation: AnnotationItem = {
      id: 'timeseriesAnnotation:7',
      kind: 'timeseriesAnnotation',
      start: new Date('2026-11-03T14:00:00Z').getTime(),
      end: 'ongoing',
      title: 'Ingestion outage',
      annotationType: 'inbound_filter_change',
      environmentId: null,
      pinned: true,
      severity: 'high',
    };

    let annotationsRequest: jest.Mock;

    function renderAnnotationsHook({
      releases,
      timeseriesAnnotations,
      organization: hookOrganization = annotationsOrganization,
    }: {
      releases: Array<{date: string; version: string}>;
      timeseriesAnnotations: TimeseriesAnnotation[];
      organization?: Organization;
    }) {
      MockApiClient.addMockResponse({
        url: `/organizations/${hookOrganization.slug}/releases/stats/`,
        body: releases,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${hookOrganization.slug}/releases/`,
        body: [],
      });
      annotationsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${hookOrganization.slug}/timeseries-annotations/`,
        body: timeseriesAnnotations,
      });

      return renderHookWithProviders(
        () =>
          useChartLayers({
            dataset: DiscoverDatasets.SPANS,
            interval: '1h',
            source: 'explore',
          }),
        {organization: hookOrganization}
      );
    }

    it('feeds releases and flag changes into the annotations band', async () => {
      const {result} = renderAnnotationsHook({
        releases: [release],
        timeseriesAnnotations: [flagChange],
      });

      await waitFor(() =>
        expect(result.current.annotations).toEqual([releaseAnnotation, flagAnnotation])
      );
      expect(result.current.layerControl?.layers).toEqual([
        expect.objectContaining({value: 'dropped-data'}),
        expect.objectContaining({value: 'releases', selected: true}),
        expect.objectContaining({value: 'flags', label: 'Flags', selected: true}),
        expect.objectContaining({value: 'changes', disabled: true}),
      ]);
    });

    it('feeds timeseries annotations whose type flag is on into the annotations band', async () => {
      const {result} = renderAnnotationsHook({
        releases: [],
        timeseriesAnnotations: [
          change,
          {...change, id: '8', annotationType: 'sentry_outage'},
        ],
      });

      await waitFor(() => expect(result.current.annotations).toEqual([changeAnnotation]));
      expect(result.current.layerControl?.layers).toContainEqual(
        expect.objectContaining({value: 'changes', label: 'Changes', selected: true})
      );
      expect(annotationsRequest).toHaveBeenCalledWith(
        `/organizations/${annotationsOrganization.slug}/timeseries-annotations/`,
        expect.objectContaining({
          query: expect.objectContaining({scope: ['spans', 'global']}),
        })
      );
    });

    it('has no Flags layer when flag change annotations are off', async () => {
      const {result} = renderAnnotationsHook({
        releases: [release],
        timeseriesAnnotations: [flagChange],
        organization: OrganizationFixture({
          features: ['explore-data-fidelity-annotations', 'timeseries-annotations'],
        }),
      });

      await waitFor(() =>
        expect(result.current.annotations).toEqual([releaseAnnotation])
      );
      expect(result.current.layerControl?.layers).not.toContainEqual(
        expect.objectContaining({value: 'flags'})
      );
    });

    it('toggles releases in the annotations band from the Releases layer', async () => {
      const {result} = renderAnnotationsHook({
        releases: [release],
        timeseriesAnnotations: [],
      });

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
      const {result} = renderAnnotationsHook({
        releases: [release],
        timeseriesAnnotations: [flagChange],
      });

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

    it('opens the drawer on the activity section when a bucket is clicked', async () => {
      Element.prototype.scrollIntoView = jest.fn();
      const {result, router} = renderAnnotationsHook({
        releases: [release],
        timeseriesAnnotations: [flagChange],
      });
      await waitFor(() => expect(result.current.annotations).toHaveLength(2));

      act(() => result.current.onAnnotationClick());

      await waitFor(() => expect(router.location.query.contextTab).toBe('annotations'));
      expect(router.location.query.contextSection).toBe('activity');
      expect(router.location.query.droppedData).toBe('spans');
      expect(trackAnalytics).toHaveBeenCalledWith('explore.chart_context.drawer_opened', {
        organization: annotationsOrganization,
        dataset: DiscoverDatasets.SPANS,
        source: 'explore',
        tab: 'annotations',
        section: 'activity',
      });
    });

    it('disables the Releases and Flags layers when the range has neither', async () => {
      const {result} = renderAnnotationsHook({releases: [], timeseriesAnnotations: []});

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

  it('toggles and tracks low-confidence markers from the Confidence layer', async () => {
    const confidenceOrganization = OrganizationFixture({
      features: [
        'explore-data-fidelity-annotations',
        'data-browsing-time-series-confidence',
      ],
    });
    const {result} = renderHookWithProviders(
      () =>
        useChartLayers({
          dataset: DiscoverDatasets.SPANS,
          interval: '1h',
          source: 'explore',
        }),
      {organization: confidenceOrganization}
    );

    await waitFor(() =>
      expect(result.current.layerControl?.layers.map(layer => layer.value)).toEqual([
        'dropped-data',
        'confidence',
      ])
    );
    expect(result.current.showConfidence).toBe(true);

    act(() => result.current.layerControl!.onChange('confidence', false));

    expect(result.current.showConfidence).toBe(false);
    expect(result.current.droppedData.band).toBeDefined();
    expect(trackAnalytics).toHaveBeenCalledWith('explore.confidence.layer_toggled', {
      organization: confidenceOrganization,
      source: 'explore',
      selected: false,
    });
  });
});
