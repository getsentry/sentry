import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {WidgetType} from 'sentry/views/dashboards/types';

import {useWidgetChartLayers} from './useWidgetChartLayers';

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

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('returns the dropped data band for supported widgets', async () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization}
    );

    await waitFor(() => expect(result.current.droppedData.band).toBeDefined());
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

  it('toggles releases from the Releases layer', () => {
    const {result} = renderHookWithProviders(
      () => useWidgetChartLayers({widget: spansWidget, interval: '5m'}),
      {organization: OrganizationFixture()}
    );

    expect(result.current.showReleases).toBe(true);
    expect(result.current.layerControl?.layers).toEqual([
      {value: 'releases', label: 'Releases', selected: true},
    ]);

    act(() => result.current.layerControl?.onChange('releases', false));

    expect(result.current.showReleases).toBe(false);
    expect(result.current.layerControl?.layers[0]?.selected).toBe(false);
  });

  it('adds the dropped data layer once it loads and toggles the band', async () => {
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
});
