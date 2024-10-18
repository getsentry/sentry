import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {
  getCustomEventsFieldRenderer,
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
      pathname: '/organizations/org-slug/performance/trace/abcd/',
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
