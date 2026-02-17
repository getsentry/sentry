import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {
  getCustomEventsFieldRenderer,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';

const theme = ThemeFixture();

describe('transformEventsResponseToTable', () => {
  it('unsplats table meta field types', () => {
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
    const customFieldRenderer = getCustomEventsFieldRenderer('trace', {});
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
    const customFieldRenderer = getCustomEventsFieldRenderer('id', {});
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

  it('links << unparameterized >> title/transaction columns to event details', async () => {
    const project = ProjectFixture();
    const customFieldRenderer = getCustomEventsFieldRenderer('title', {});
    const {router} = render(
      customFieldRenderer(
        {title: '<< unparameterized >>'},
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

    await userEvent.click(await screen.findByText('<< unparameterized >>'));
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/discover/results/'
    );
    expect(router.location.query).toEqual(
      expect.objectContaining({
        query: 'event.type:transaction transaction.source:"url"',
      })
    );
  });
});
