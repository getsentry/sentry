import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {
  getCustomEventsFieldRenderer,
  transformEventsResponseToSeries,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';

describe('transformEventsResponseToTable', function () {
  it('unsplats table meta field types', function () {
    const rawData = {
      data: [{'p75(measurements.inp)': null}],
      meta: {
        'p75(measurements.inp)': 'duration',
        units: {
          'p75(measurements.inp)': 'millisecond',
        },
        dataset: 'metricsEnhanced',
        fields: {
          'p75(measurements.inp)': 'duration',
        },
      },
      title: 'A Query',
    } as unknown as TableData;

    const widgetQuery = WidgetQueryFixture();

    expect(transformEventsResponseToTable(rawData, widgetQuery).meta).toEqual({
      'p75(measurements.inp)': 'duration',
      units: {
        'p75(measurements.inp)': 'millisecond',
      },
      dataset: 'metricsEnhanced',
      fields: {
        'p75(measurements.inp)': 'duration',
      },
    });
  });
});

describe('transformEventsResponseToSeries', function () {
  it('converts a single series response to an array', function () {
    const rawData: EventsStats = {
      data: [
        [1737731713, [{count: 17}]],
        [1737731773, [{count: 22}, {count: 1}]],
      ],
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 23,
          },
        ],
        seriesName: 'count()',
      },
    ]);
  });

  it('converts a multi series response to an array', function () {
    const rawData: MultiSeriesEventsStats = {
      'count()': {
        data: [
          [1737731713, [{count: 17}]],
          [1737731773, [{count: 22}]],
        ],
        order: 1,
      },
      'avg(transaction.duration)': {
        data: [
          [1737731713, [{count: 12.4}]],
          [1737731773, [{count: 17.7}, {count: 1.0}]],
        ],
        order: 0,
      },
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()', 'avg(transaction.duration)'],
      aggregates: ['count()', 'avg(transaction.duration)'],
      columns: [],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 12.4,
          },
          {
            name: 1737731773000,
            value: 18.7,
          },
        ],
        seriesName: 'avg(transaction.duration)',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 22,
          },
        ],
        seriesName: 'count()',
      },
    ]);
  });

  it('converts a grouped series response to an array', function () {
    const rawData: GroupedMultiSeriesEventsStats = {
      prod: {
        'count()': {
          data: [
            [1737731713, [{count: 170}]],
            [1737731773, [{count: 220}]],
          ],
        },
        'avg(transaction.duration)': {
          data: [
            [1737731713, [{count: 124}]],
            [1737731773, [{count: 177}, {count: 10}]],
          ],
        },
        order: 1,
      },
      dev: {
        'count()': {
          data: [
            [1737731713, [{count: 17}]],
            [1737731773, [{count: 22}]],
          ],
        },
        'avg(transaction.duration)': {
          data: [
            [1737731713, [{count: 12.4}]],
            [1737731773, [{count: 17.7}, {count: 1.0}]],
          ],
        },
        order: 0,
      },
    };

    const widgetQuery = WidgetQueryFixture({
      fields: ['count()', 'avg(transaction.duration)'],
      aggregates: ['count()', 'avg(transaction.duration)'],
      columns: ['env'],
    });

    expect(transformEventsResponseToSeries(rawData, widgetQuery)).toEqual([
      {
        data: [
          {
            name: 1737731713000,
            value: 17,
          },
          {
            name: 1737731773000,
            value: 22,
          },
        ],
        seriesName: 'dev : count()',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 12.4,
          },
          {
            name: 1737731773000,
            value: 18.7,
          },
        ],
        seriesName: 'dev : avg(transaction.duration)',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 170,
          },
          {
            name: 1737731773000,
            value: 220,
          },
        ],
        seriesName: 'prod : count()',
      },
      {
        data: [
          {
            name: 1737731713000,
            value: 124,
          },
          {
            name: 1737731773000,
            value: 187,
          },
        ],
        seriesName: 'prod : avg(transaction.duration)',
      },
    ]);
  });
});

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
    const customFieldRenderer = getCustomEventsFieldRenderer('trace', {});
    render(
      customFieldRenderer(
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
    const customFieldRenderer = getCustomEventsFieldRenderer('id', {});
    render(
      customFieldRenderer(
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

  it('links << unparameterized >> title/transaction columns to event details', async function () {
    const project = ProjectFixture();
    const customFieldRenderer = getCustomEventsFieldRenderer('title', {});
    render(
      customFieldRenderer(
        {title: '<< unparameterized >>'},
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

    await userEvent.click(await screen.findByText('<< unparameterized >>'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: `/organizations/org-slug/discover/results/`,
        query: expect.objectContaining({
          query: 'event.type:transaction transaction.source:"url"',
        }),
      })
    );
  });
});
