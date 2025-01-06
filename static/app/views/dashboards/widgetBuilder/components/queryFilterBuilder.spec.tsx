import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');

describe('QueryFilterBuilder', () => {
  let organization: Organization;
  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['dashboards-widget-builder-redesign'],
    });
    jest.mocked(useCustomMeasurements).mockReturnValue({
      customMeasurements: {},
    });
    jest.mocked(useSpanTags).mockReturnValue({});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
    });
  });

  it('renders a dataset-specific query filter bar', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder onQueryConditionChange={() => {}} error={{}} />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );
    expect(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder onQueryConditionChange={() => {}} error={{}} />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.SPANS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),
      }
    );
    expect(
      await screen.findByPlaceholderText('Search for spans, users, tags, and more')
    ).toBeInTheDocument();
  });

  it('renders a legend alias input for charts', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder onQueryConditionChange={() => {}} error={{}} />
      </WidgetBuilderProvider>,
      {
        organization,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
      }
    );

    expect(await screen.findByPlaceholderText('Legend Alias')).toBeInTheDocument();
  });
});
