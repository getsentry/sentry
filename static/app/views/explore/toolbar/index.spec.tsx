import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageParamsProvider,
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExplorePageParams,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';

jest.mock('sentry/actionCreators/modal');

describe('ExploreToolbar', function () {
  const organization = OrganizationFixture({
    features: ['alerts-eap', 'dashboards-eap', 'dashboards-edit', 'explore-multi-query'],
  });

  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    const project = ProjectFixture({
      id: '1',
      slug: 'proj-slug',
      organization,
    });

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
  });

  it('allows changing mode', async function () {
    let mode: any;
    function Component() {
      mode = useExploreMode();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-mode');

    const samples = within(section).getByRole('radio', {name: 'Samples'});
    const aggregates = within(section).getByRole('radio', {name: 'Aggregates'});

    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(mode).toEqual(Mode.SAMPLES);

    await userEvent.click(aggregates);
    expect(samples).not.toBeChecked();
    expect(aggregates).toBeChecked();
    expect(mode).toEqual(Mode.AGGREGATE);

    await userEvent.click(samples);
    expect(samples).toBeChecked();
    expect(aggregates).not.toBeChecked();
    expect(mode).toEqual(Mode.SAMPLES);
  });

  it('inserts group bys from aggregate mode as fields in samples mode', async function () {
    let fields, groupBys;
    function Component() {
      fields = useExploreFields();
      groupBys = useExploreGroupBys();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-mode');

    const samples = within(section).getByRole('radio', {name: 'Samples'});
    const aggregates = within(section).getByRole('radio', {name: 'Aggregates'});

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
    ]); // default

    // Add a group by, and leave one unselected
    await userEvent.click(aggregates);
    const groupBy = screen.getByTestId('section-group-by');
    await userEvent.click(within(groupBy).getByRole('button', {name: '\u2014'}));
    await userEvent.click(within(groupBy).getByRole('option', {name: 'release'}));
    expect(groupBys).toEqual(['release']);
    await userEvent.click(within(groupBy).getByRole('button', {name: 'Add Group'}));
    expect(groupBys).toEqual(['release', '']);

    await userEvent.click(samples);
    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
      'release',
    ]);
  });

  it('disables changing visualize fields for count', function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);

    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to count(span.duration) when using count', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(visualizes).toEqual([new Visualize(['avg(span.self_time)'], 'A')]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count'}));

    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);
  });

  it('defaults count_unique argument to span.op', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(visualizes).toEqual([new Visualize(['count_unique(span.op)'], 'A')]);

    // try changing the aggregate + field
    await userEvent.click(within(section).getByRole('button', {name: 'count_unique'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(visualizes).toEqual([new Visualize(['avg(span.self_time)'], 'A')]);
    //
    // try changing the aggregate back to count_unique
    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(visualizes).toEqual([new Visualize(['count_unique(span.op)'], 'A')]);
  });

  it('allows changing visualizes', async function () {
    let fields, visualizes: any;
    function Component() {
      fields = useExploreFields();
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
    ]); // default

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    expect(visualizes).toEqual([new Visualize(['avg(span.duration)'], 'A')]);

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([new Visualize(['avg(span.self_time)'], 'A')]);

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
      'span.self_time',
    ]);

    // try adding an overlay
    await userEvent.click(within(section).getByRole('button', {name: 'Add Series'}));
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    expect(visualizes).toEqual([
      new Visualize(['avg(span.self_time)', 'avg(span.duration)'], 'A'),
    ]);

    // try adding a new chart
    await userEvent.click(within(section).getByRole('button', {name: 'Add Chart'}));
    expect(visualizes).toEqual([
      new Visualize(['avg(span.self_time)', 'avg(span.duration)'], 'A'),
      new Visualize(['count(span.duration)'], 'B'),
    ]);

    // delete first overlay
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[0]!);
    expect(visualizes).toEqual([
      new Visualize(['avg(span.duration)'], 'A'),
      new Visualize(['count(span.duration)'], 'B'),
    ]);

    // delete second chart
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[1]!);
    expect(visualizes).toEqual([new Visualize(['avg(span.duration)'], 'A')]);

    // only one left so we hide the delete button
    expect(within(section).queryByLabelText('Remove Overlay')).not.toBeInTheDocument();
  });

  it('allows changing visualizes equations', async function () {
    let fields, visualizes: any;
    function Component() {
      fields = useExploreFields();
      visualizes = useExploreVisualizes();
      return <ExploreToolbar extras={['equations']} />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize(['count(span.duration)'], 'A')]);

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
    ]); // default

    let input: HTMLElement;

    // try changing the field
    input = within(section).getByRole('combobox', {
      name: 'Select an attribute',
    });
    await userEvent.click(input);
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    await userEvent.keyboard('{Escape}');

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
      'span.self_time',
    ]);

    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');

    await userEvent.click(within(section).getByRole('option', {name: 'avg(\u2026)'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(section).getByText('Visualize'));

    expect(visualizes).toEqual([new Visualize(['avg(span.self_time)'], 'A')]);

    // try adding an overlay
    await userEvent.click(within(section).getByRole('button', {name: 'Add Series'}));
    input = within(section)
      .getAllByRole('combobox', {
        name: 'Select an attribute',
      })
      .at(-1)!;
    await userEvent.click(input);
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(section).getByText('Visualize'));

    expect(visualizes).toEqual([
      new Visualize(['avg(span.self_time)', 'count(span.self_time)'], 'A'),
    ]);

    // try adding a new chart
    await userEvent.click(within(section).getByRole('button', {name: 'Add Chart'}));
    expect(visualizes).toEqual([
      new Visualize(['avg(span.self_time)', 'count(span.self_time)'], 'A'),
      new Visualize(['count(span.duration)'], 'B'),
    ]);

    // delete first overlay
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[0]!);
    expect(visualizes).toEqual([
      new Visualize(['count(span.self_time)'], 'A'),
      new Visualize(['count(span.duration)'], 'B'),
    ]);

    // delete second chart
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[1]!);
    expect(visualizes).toEqual([new Visualize(['count(span.self_time)'], 'A')]);

    // only one left so cant be deleted
    expect(within(section).getByLabelText('Remove Overlay')).toBeDisabled();
  });

  it('allows changing group bys', async function () {
    let groupBys: any;

    function Component() {
      groupBys = useExploreGroupBys();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(screen.queryByTestId('section-group-by')).not.toBeInTheDocument();

    // click the aggregates mode to enable
    await userEvent.click(
      within(screen.getByTestId('section-mode')).getByRole('radio', {
        name: 'Aggregates',
      })
    );

    let options;
    const section = screen.getByTestId('section-group-by');

    expect(groupBys).toEqual(['']);

    await userEvent.click(within(section).getByRole('button', {name: '\u2014'}));
    options = await within(section).findAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(groupBys).toEqual(['span.op']);

    await userEvent.click(within(section).getByRole('button', {name: 'span.op'}));
    options = await within(section).findAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    await userEvent.click(within(section).getByRole('option', {name: 'project'}));
    expect(groupBys).toEqual(['project']);

    await userEvent.click(within(section).getByRole('button', {name: 'Add Group'}));
    expect(groupBys).toEqual(['project', '']);

    await userEvent.click(within(section).getByRole('button', {name: '\u2014'}));
    options = await within(section).findAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    await userEvent.click(
      within(section).getByRole('option', {name: 'span.description'})
    );
    expect(groupBys).toEqual(['project', 'span.description']);

    await userEvent.click(within(section).getAllByLabelText('Remove Column')[0]!);
    expect(groupBys).toEqual(['span.description']);

    // only 1 left but it's not empty
    expect(within(section).getByLabelText('Remove Column')).toBeEnabled();

    await userEvent.click(within(section).getByLabelText('Remove Column'));
    expect(groupBys).toEqual(['']);

    // last one so remove column button is hidden
    expect(within(section).queryByLabelText('Remove Column')).not.toBeInTheDocument();
  });

  it('switches to aggregates mode when modifying group bys', async function () {
    let groupBys: any;
    let mode: any;

    function Component() {
      groupBys = useExploreGroupBys();
      mode = useExploreMode();
      return <ExploreToolbar extras={['tabs']} />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(mode).toEqual(Mode.SAMPLES);
    expect(groupBys).toEqual(['']);

    const section = screen.getByTestId('section-group-by');

    await userEvent.click(within(section).getByRole('button', {name: '\u2014'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));

    expect(mode).toEqual(Mode.AGGREGATE);
    expect(groupBys).toEqual(['span.op']);
  });

  it('switches to aggregates mode when adding group bys', async function () {
    let groupBys: any;
    let mode: any;

    function Component() {
      groupBys = useExploreGroupBys();
      mode = useExploreMode();
      return <ExploreToolbar extras={['tabs']} />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(mode).toEqual(Mode.SAMPLES);
    expect(groupBys).toEqual(['']);

    const section = screen.getByTestId('section-group-by');

    await userEvent.click(within(section).getByRole('button', {name: 'Add Group'}));

    expect(mode).toEqual(Mode.AGGREGATE);
    expect(groupBys).toEqual(['', '']);
  });

  it('allows changing sort by', async function () {
    let sortBys: any;
    function Component() {
      sortBys = useExploreSortBys();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-sort-by');

    // this is the default
    expect(within(section).getByRole('button', {name: 'timestamp'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);

    // check the default field options
    const fields = [
      'id',
      'span.description',
      'span.duration',
      'span.op',
      'timestamp',
      'transaction',
    ];
    await userEvent.click(within(section).getByRole('button', {name: 'timestamp'}));
    const fieldOptions = await within(section).findAllByRole('option');
    expect(fieldOptions).toHaveLength(fields.length);
    fieldOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(fields[i]!);
    });

    // try changing the field
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'span.op', kind: 'desc'}]);

    // check the kind options
    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    const kindOptions = await within(section).findAllByRole('option');
    expect(kindOptions).toHaveLength(2);
    expect(kindOptions[0]).toHaveTextContent('Desc');
    expect(kindOptions[1]).toHaveTextContent('Asc');

    // try changing the kind
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));
    expect(within(section).getByRole('button', {name: 'span.op'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Asc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'span.op', kind: 'asc'}]);
  });

  it('takes you to suggested query', async function () {
    let pageParams: any;
    function Component() {
      pageParams = useExplorePageParams();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = screen.getByTestId('section-suggested-queries');

    await userEvent.click(within(section).getByText('Slowest Ops'));
    expect(pageParams).toEqual(
      expect.objectContaining({
        fields: [
          'id',
          'project',
          'span.op',
          'span.description',
          'span.duration',
          'timestamp',
        ],
        groupBys: ['span.op'],
        mode: Mode.AGGREGATE,
        query: '',
        sortBys: [{field: 'avg(span.duration)', kind: 'desc'}],
        visualizes: [
          new Visualize(['avg(span.duration)'], 'A'),
          new Visualize(['p50(span.duration)'], 'B'),
        ],
      })
    );
  });

  it('opens compare queries', async function () {
    const router = RouterFixture({
      location: {
        pathname: '/traces/',
        query: {
          visualize: encodeURIComponent('{"chartType":1,"yAxes":["p95(span.duration)"]}'),
        },
      },
    });

    function Component() {
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );

    const section = screen.getByTestId('section-save-as');

    await userEvent.click(within(section).getByText(/Compare/));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/traces/compare/',
      query: expect.objectContaining({
        queries: [
          '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["count(span.duration)"]}',
          '{"chartType":1,"fields":["id","span.duration","timestamp"],"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["count(span.duration)"]}',
        ],
      }),
    });
  });

  it('opens the right alert', async function () {
    const router = RouterFixture({
      location: {
        pathname: '/traces/',
        query: {
          visualize: encodeURIComponent('{"chartType":1,"yAxes":["avg(span.duration)"]}'),
        },
      },
    });

    function Component() {
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );

    const section = screen.getByTestId('section-save-as');

    await userEvent.click(within(section).getByText(/Save as/));
    await userEvent.hover(within(section).getByText('An Alert for'));
    await userEvent.click(screen.getByText('count(spans)'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/alerts/new/metric/',
      query: expect.objectContaining({
        aggregate: 'count(span.duration)',
        dataset: 'events_analytics_platform',
      }),
    });
  });

  it('add to dashboard options correctly', async function () {
    const router = RouterFixture({
      location: {
        pathname: '/traces/',
        query: {
          visualize: encodeURIComponent(
            '{"chartType":1,"yAxes":["count(span.duration)"]}'
          ),
        },
      },
    });

    function Component() {
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );

    const section = screen.getByTestId('section-save-as');

    await userEvent.click(within(section).getByText(/Save as/));
    await userEvent.click(within(section).getByText('A Dashboard widget'));
    await waitFor(() => {
      expect(openAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: expect.objectContaining({
            displayType: 'bar',
            queries: [
              {
                aggregates: ['count(span.duration)'],
                columns: [],
                conditions: '',
                fields: ['count(span.duration)'],
                name: '',
                orderby: '-timestamp',
              },
            ],
            title: 'Custom Widget',
            widgetType: 'spans',
          }),
          widgetAsQueryParams: expect.objectContaining({
            dataset: 'spans',
            defaultTableColumns: [
              'id',
              'span.op',
              'span.description',
              'span.duration',
              'transaction',
              'timestamp',
            ],
            defaultTitle: 'Custom Widget',
            defaultWidgetQuery:
              'name=&aggregates=count(span.duration)&columns=&fields=count(span.duration)&conditions=&orderby=-timestamp',
            displayType: 'bar',
            end: undefined,
            field: [
              'id',
              'span.op',
              'span.description',
              'span.duration',
              'transaction',
              'timestamp',
            ],
            limit: undefined,
            source: 'traceExplorer',
            start: undefined,
            statsPeriod: '14d',
          }),
        })
      );
    });
  });

  it('highlights save button when saved query is changed', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'GET',
      body: {
        query: [
          {
            query: '',
            fields: ['count(span.duration)'],
            groupby: ['span.op'],
            orderby: '-count(span.duration)',
            visualize: [
              {
                chartType: 1,
                yAxes: ['count(span.duration)'],
              },
            ],
            mode: 'aggregate',
          },
        ],
        range: '14d',
        projects: [],
        environment: [],
      },
    });

    const router = RouterFixture({
      location: {
        pathname: '/traces/',
        query: {
          query: '',
          visualize: '{"chartType":1,"yAxes":["count(span.duration)"]}',
          groupBy: ['span.op'],
          sort: ['-count(span.duration)'],
          field: ['count(span.duration)'],
          id: '123',
          mode: 'aggregate',
        },
      },
    });

    function Component() {
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );
    screen.getByText('Save as\u2026');
    const section = screen.getByTestId('section-sort-by');
    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          sort: ['count(span.duration)'],
        }),
      })
    );

    // Simulate navigation from sort change
    router.location.query.sort = ['count(span.duration)'];
    router.push(router.location);
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });
});
