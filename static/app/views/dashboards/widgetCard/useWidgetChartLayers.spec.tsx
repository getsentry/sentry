import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('turns off releases for mobile builds widgets', () => {
    const {result} = renderHookWithProviders(
      () =>
        useWidgetChartLayers({
          widget: WidgetFixture({widgetType: WidgetType.PREPROD_APP_SIZE}),
        }),
      {organization}
    );

    expect(result.current.showReleases).toBe(false);
  });
});
