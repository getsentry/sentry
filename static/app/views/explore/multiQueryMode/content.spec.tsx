import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';

describe('MultiQueryModeContent', function () {
  const organization = OrganizationFixture();

  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [{key: 'span.op', name: 'span.op'}],
    });
  });

  it('updates visualization and outdated sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-sort-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'id'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates group bys and outdated sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(queries).toEqual([
      {
        yAxes: ['avg(span.duration)'],
        chartType: 1,
        sortBys: [
          {
            field: 'avg(span.duration)',
            kind: 'desc',
          },
        ],
        query: '',
        groupBys: ['span.op'],
        fields: ['id', 'span.duration'],
      },
    ]);
  });

  it('updates query at the correct index', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    // Add chart
    await userEvent.click(screen.getByRole('button', {name: 'Add Query'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    await userEvent.click(screen.getAllByLabelText('Delete Query')[0]!);
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
  });
});
