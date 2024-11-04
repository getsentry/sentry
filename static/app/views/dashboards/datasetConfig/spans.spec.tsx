import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES, FieldKind} from 'sentry/utils/fields';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {WidgetType} from 'sentry/views/dashboards/types';

describe('SpansConfig', () => {
  let organization: Organization;
  const api: Client = new MockApiClient();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    organization = OrganizationFixture({
      features: ['performance-view'],
    });
  });

  it('returns all of the EAP aggregations as primary options', () => {
    const functionOptions = Object.keys(
      SpansConfig.getTableFieldOptions(organization, {})
    )
      .filter(func => func.startsWith('function'))
      .map(func => func.split(':')[1]);

    expect(functionOptions).toEqual(ALLOWED_EXPLORE_VISUALIZE_AGGREGATES);
  });

  it('can make a series request with the expected dataset', async () => {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
    });

    // Trigger request
    SpansConfig.getSeriesRequest!(
      api,
      widget,
      0,
      organization,
      PageFiltersFixture(),
      undefined,
      'test-referrer',
      undefined
    );

    expect(eventsStatsMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({dataset: DiscoverDatasets.SPANS_EAP}),
        })
      );
    });
  });

  it('returns the string tags as group by options', () => {
    const mockTags = {
      ['transaction']: {
        name: 'transaction',
        key: 'transaction',
        kind: FieldKind.TAG,
      },
      ['platform']: {
        name: 'platform',
        key: 'platform',
        kind: FieldKind.TAG,
      },
      ['span.duration']: {
        name: 'span.duration',
        key: 'span.duration',
        kind: FieldKind.MEASUREMENT,
      },
    };
    const groupByOptions = SpansConfig.getGroupByFieldOptions!(organization, mockTags);

    expect(Object.keys(groupByOptions)).toEqual(['tag:transaction', 'tag:platform']);
  });
});
