import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import {EventView} from 'sentry/utils/discover/eventView';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {DisplayType, type WidgetQuery} from 'sentry/views/dashboards/types';

const theme = ThemeFixture();

describe('SpansConfig', () => {
  let organization: Organization;

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

  it('adds Explore _if combinators from aggregates to timeseries sort options', () => {
    const combinator = 'avg_if(`span.op:db`,span.duration)';
    const widgetQuery: WidgetQuery = {
      name: '',
      fields: ['transaction', combinator],
      columns: ['transaction'],
      fieldAliases: [],
      aggregates: ['avg(span.duration)', combinator],
      conditions: '',
      orderby: '-avg(span.duration)',
    };

    const options = SpansConfig.getTimeseriesSortOptions(organization, widgetQuery, {});

    expect(options[`field:${combinator}`]).toEqual({
      label: combinator,
      value: {
        kind: 'field',
        meta: {
          dataType: 'number',
          name: combinator,
        },
      },
    });
  });

  it('renders internal error count as a link to explore with error filter', () => {
    const field =
      'count_if(`span.status:internal_error`) + count_if(`span.status:error`)';
    const location = LocationFixture();

    const baseEventViewOptions: EventViewOptions = {
      start: undefined,
      end: undefined,
      createdBy: UserFixture(),
      display: undefined,
      fields: [],
      sorts: [],
      query: '',
      project: [1],
      environment: [],
      yAxis: 'count()',
      id: undefined,
      name: undefined,
      statsPeriod: '14d',
      team: [],
      topEvents: undefined,
    };

    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          fields: ['gen_ai.tool.name', field],
          columns: ['gen_ai.tool.name'],
          fieldAliases: [],
          aggregates: [field],
          conditions: 'gen_ai.operation.type:tool',
          orderby: `-${field}`,
        },
      ],
    });

    const org = OrganizationFixture({features: ['performance-view']});
    const renderer = SpansConfig.getCustomFieldRenderer!(
      field,
      {},
      widget,
      org,
      undefined
    );
    render(
      renderer(
        {[field]: 5, 'gen_ai.tool.name': 'Web Search'},
        {
          organization: org,
          location,
          navigate: jest.fn(),
          theme,
          eventView: new EventView({
            ...baseEventViewOptions,
            fields: [{field}],
          }),
        }
      ) as React.ReactElement<any, any>
    );

    const link = screen.getByRole('link', {name: '5'});
    expect(link).toBeInTheDocument();

    const href = link.getAttribute('href')!;
    expect(href).toContain('gen_ai.tool.name%3A%22Web%20Search%22');
    expect(href).toContain('gen_ai.operation.type%3Atool');
    expect(href).toContain('span.status%3A%5Binternal_error%2Cerror%5D');
  });
});
