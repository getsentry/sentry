import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetType} from 'sentry/views/dashboards/types';

import {useWidgetChartLayers} from './useWidgetChartLayers';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations', 'dashboards-data-fidelity-annotations'],
});
const spansWidget = WidgetFixture({widgetType: WidgetType.SPANS});

describe('useWidgetChartLayers', () => {
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

  it('returns the dropped data band for supported widgets', async () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization}
    );

    await waitFor(() => expect(result.current.droppedData.band).toBeDefined());
  });

  it('tracks opening the drawer from the band as a dashboards event', async () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization}
    );

    await waitFor(() => expect(result.current.droppedData.band).toBeDefined());
    act(() => result.current.droppedData.band!.onClick!());

    expect(trackAnalytics).toHaveBeenCalledWith('explore.dropped_data.drawer_opened', {
      organization,
      dataset: 'spans',
      source: 'dashboards',
    });
  });

  it.each([
    [
      'the widget type is unsupported',
      {widgetType: WidgetType.TRANSACTIONS},
      organization,
    ],
    ['the flag is off', {}, OrganizationFixture()],
  ])('does not request dropped data when %s', (_name, widgetProps, org) => {
    renderHookWithProviders(
      () =>
        useWidgetChartLayers({widget: {...spansWidget, ...widgetProps}, interval: '5m'}),
      {organization: org}
    );

    expect(droppedDataRequest).not.toHaveBeenCalled();
  });

  it('toggles and tracks releases from the Releases layer', () => {
    const releasesOrganization = OrganizationFixture();
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization: releasesOrganization}
    );

    expect(result.current.showReleases).toBe(true);
    expect(result.current.layerControl?.layers).toEqual([
      {value: 'releases', label: 'Releases', selected: true},
    ]);

    act(() => result.current.layerControl?.onChange('releases', false));

    expect(result.current.showReleases).toBe(false);
    expect(result.current.layerControl?.layers[0]?.selected).toBe(false);
    expect(trackAnalytics).toHaveBeenCalledWith('releases.bubbles_legend', {
      organization: releasesOrganization,
      selected: false,
    });
  });

  it('adds the dropped data layer once it loads, and toggles and tracks the band', async () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization}
    );

    await waitFor(() =>
      expect(result.current.layerControl?.layers.map(layer => layer.label)).toEqual([
        'Releases',
        'Dropped Spans',
      ])
    );

    act(() => result.current.layerControl?.onChange('dropped-data', false));

    expect(result.current.droppedData.band).toBeUndefined();
    expect(trackAnalytics).toHaveBeenCalledWith('explore.dropped_data.layer_toggled', {
      organization,
      dataset: 'spans',
      source: 'dashboards',
      selected: false,
    });
  });

  it('leaves out the dropped data layer when the band is hidden', async () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m', hidden: true}),
      {organization}
    );

    await waitFor(() => expect(result.current.droppedData.layerControl).toBeDefined());
    expect(result.current.layerControl?.layers.map(layer => layer.value)).toEqual([
      'releases',
    ]);
  });

  it('has no layers when disabled', () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, enabled: false}),
      {organization}
    );

    expect(result.current.layerControl).toBeUndefined();
  });

  it('turns off releases for mobile builds widgets', () => {
    const {result} = renderHookWithProviders(
      () =>
        useWidgetChartLayers({
          widget: WidgetFixture({widgetType: WidgetType.PREPROD_APP_SIZE}),
        }),
      {organization}
    );

    expect(result.current.showReleases).toBe(false);
    expect(result.current.layerControl).toBeUndefined();
  });

  describe('confidence', () => {
    const confidenceOrganization = OrganizationFixture({
      features: ['data-browsing-time-series-confidence'],
    });

    it('toggles and tracks low-confidence markers from the Confidence layer', () => {
      const {result} = renderHookWithProviders(
        () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
        {organization: confidenceOrganization}
      );

      expect(result.current.showConfidence).toBe(true);
      expect(result.current.layerControl?.layers).toContainEqual({
        value: 'confidence',
        label: 'Confidence',
        selected: true,
      });

      act(() => result.current.layerControl?.onChange('confidence', false));

      expect(result.current.showConfidence).toBe(false);
      expect(result.current.layerControl?.layers).toContainEqual(
        expect.objectContaining({value: 'confidence', selected: false})
      );
      expect(trackAnalytics).toHaveBeenCalledWith('explore.confidence.layer_toggled', {
        organization: confidenceOrganization,
        source: 'dashboards',
        selected: false,
      });
    });

    it('leaves out the Confidence layer for widgets without confidence data', () => {
      const {result} = renderHookWithProviders(
        () =>
          useWidgetChartLayers({
            widget: WidgetFixture({widgetType: WidgetType.ERRORS}),
            interval: '5m',
          }),
        {organization: confidenceOrganization}
      );

      expect(result.current.layerControl?.layers.map(layer => layer.value)).toEqual([
        'releases',
      ]);
    });

    it('leaves out the Confidence layer without the feature', () => {
      const {result} = renderHookWithProviders(
        () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
        {organization: OrganizationFixture()}
      );

      expect(result.current.layerControl?.layers.map(layer => layer.value)).toEqual([
        'releases',
      ]);
    });
  });
});
