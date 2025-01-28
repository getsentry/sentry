import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';

describe('ErrorsConfig', function () {
  describe('getCustomFieldRenderer', function () {
    const {organization, router} = initializeOrg();

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

    it('links trace ids to performance', async function () {
      const customFieldRenderer = ErrorsConfig.getCustomFieldRenderer!('trace', {});
      render(
        customFieldRenderer!(
          {trace: 'abcd'},
          {
            organization,
            location: router.location,
            eventView: new EventView({
              ...baseEventViewOptions,
              fields: [{field: 'trace'}],
            }),
          }
        ) as React.ReactElement<any, any>,
        {router}
      );
      await userEvent.click(await screen.findByText('abcd'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/dashboards/trace/abcd/',
        query: {
          pageEnd: undefined,
          pageStart: undefined,
          statsPeriod: '14d',
        },
      });
    });

    it('links event ids to event details', async function () {
      const project = ProjectFixture();
      const customFieldRenderer = ErrorsConfig.getCustomFieldRenderer!('id', {});
      render(
        customFieldRenderer!(
          {id: 'defg', 'project.name': project.slug},
          {
            organization,
            location: router.location,
            eventView: new EventView({
              ...baseEventViewOptions,
              fields: [{field: 'id'}],
              project: [parseInt(project.id, 10)],
            }),
          }
        ) as React.ReactElement<any, any>,
        {router}
      );

      await userEvent.click(await screen.findByText('defg'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: `/organizations/org-slug/discover/${project.slug}:defg/`,
        query: {
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
        },
      });
    });
  });

  describe('getEventsRequest', function () {
    let api!: Client;
    let organization!: ReturnType<typeof OrganizationFixture>;
    let mockEventsRequest!: jest.Mock;

    beforeEach(function () {
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

    it('makes a request to the errors dataset', function () {
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

  describe('getSeriesRequest', function () {
    let api!: Client;
    let organization!: ReturnType<typeof OrganizationFixture>;
    let mockEventsRequest!: jest.Mock;

    beforeEach(function () {
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

    it('makes a request to the errors dataset', function () {
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
