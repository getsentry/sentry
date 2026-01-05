import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';

const theme = ThemeFixture();

describe('ErrorsConfig', () => {
  describe('getCustomFieldRenderer', () => {
    const organization = OrganizationFixture();
    const location = LocationFixture();

    const baseEventViewOptions: EventViewOptions = {
      start: undefined,
      end: undefined,
      createdBy: UserFixture(),
      display: undefined,
      fields: [],
      sorts: [],
      query: '',
      project: [],
      environment: [],
      yAxis: 'count()',
      id: undefined,
      name: undefined,
      statsPeriod: '14d',
      team: [],
      topEvents: undefined,
    };

    it('links trace ids to performance', async () => {
      const customFieldRenderer = ErrorsConfig.getCustomFieldRenderer!('trace', {});
      const {router} = render(
        customFieldRenderer(
          {trace: 'abcd'},
          {
            organization,
            location,
            theme,
            eventView: new EventView({
              ...baseEventViewOptions,
              fields: [{field: 'trace'}],
            }),
          }
        ) as React.ReactElement<any, any>
      );
      await userEvent.click(await screen.findByText('abcd'));
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/dashboards/trace/abcd/'
      );
      expect(router.location.query).toEqual({
        pageEnd: undefined,
        pageStart: undefined,
        statsPeriod: '14d',
      });
    });

    it('links event ids to event details', async () => {
      const project = ProjectFixture();
      const customFieldRenderer = ErrorsConfig.getCustomFieldRenderer!('id', {});
      const {router} = render(
        customFieldRenderer(
          {id: 'defg', 'project.name': project.slug},
          {
            organization,
            location,
            theme,
            eventView: new EventView({
              ...baseEventViewOptions,
              fields: [{field: 'id'}],
              project: [parseInt(project.id, 10)],
            }),
          }
        ) as React.ReactElement<any, any>
      );

      await userEvent.click(await screen.findByText('defg'));
      expect(router.location.pathname).toBe(
        `/organizations/org-slug/explore/discover/${project.slug}:defg/`
      );
      expect(router.location.query).toEqual({
        display: undefined,
        environment: undefined,
        field: 'id',
        id: undefined,
        interval: undefined,
        name: undefined,
        project: project.id,
        query: '',
        sort: undefined,
        topEvents: undefined,
        widths: undefined,
        yAxis: 'count()',
        pageEnd: undefined,
        pageStart: undefined,
        statsPeriod: '14d',
      });
    });
  });

  describe('getEventsRequest', () => {
    let api!: Client;
    let organization!: ReturnType<typeof OrganizationFixture>;
    let mockEventsRequest!: jest.Mock;

    beforeEach(() => {
      MockApiClient.clearMockResponses();

      api = new MockApiClient();
      organization = OrganizationFixture();

      mockEventsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          data: [],
        },
      });
    });

    it('makes a request to the errors dataset', () => {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture();

      ErrorsConfig.getTableRequest!(
        api,
        widget,
        {
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
        organization,
        pageFilters
      );

      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.ERRORS,
          }),
        })
      );
    });
  });

  describe('getSeriesRequest', () => {
    let api!: Client;
    let organization!: ReturnType<typeof OrganizationFixture>;
    let mockEventsRequest!: jest.Mock;

    beforeEach(() => {
      MockApiClient.clearMockResponses();

      api = new MockApiClient();
      organization = OrganizationFixture();

      mockEventsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {
          data: [],
        },
      });
    });

    it('makes a request to the errors dataset', () => {
      const pageFilters = PageFiltersFixture();
      const widget = WidgetFixture({
        queries: [
          {
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            conditions: '',
            name: '',
            orderby: '',
          },
        ],
      });

      ErrorsConfig.getSeriesRequest!(api, widget, 0, organization, pageFilters);

      expect(mockEventsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.ERRORS,
          }),
        })
      );
    });
  });
});
