import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {
  PageParamsProvider,
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/actionCreators/modal');

describe('ExploreToolbar', function () {
  const organization = OrganizationFixture({
    features: ['dashboards-edit'],
  });

  beforeEach(function () {
    const project = ProjectFixture({
      id: '1',
      slug: 'proj-slug',
      organization,
    });

    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });
  });

  it('disables changing visualize fields for count', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

    expect(await within(section).findByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to count(span.duration) when using count', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(visualizes).toEqual([new Visualize('avg(span.self_time)')]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count'}));

    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);
  });

  it('disables changing visualize fields for epm', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

    // change aggregate to epm
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'epm'}));

    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to epm() when using epm', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(visualizes).toEqual([new Visualize('avg(span.self_time)')]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'epm'}));

    expect(visualizes).toEqual([new Visualize('epm()')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'epm'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    expect(visualizes).toEqual([new Visualize('avg(span.duration)')]);
  });

  it('defaults count_unique argument to span.op', async function () {
    let visualizes: any;
    function Component() {
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(visualizes).toEqual([new Visualize('count_unique(span.op)')]);

    // try changing the aggregate + field
    await userEvent.click(within(section).getByRole('button', {name: 'count_unique'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(visualizes).toEqual([new Visualize('avg(span.self_time)')]);
    //
    // try changing the aggregate back to count_unique
    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(visualizes).toEqual([new Visualize('count_unique(span.op)')]);
  });

  it('allows changing visualizes', async function () {
    let fields!: string[];
    let visualizes: any;
    function Component() {
      fields = useExploreFields();
      visualizes = useExploreVisualizes();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([new Visualize('count(span.duration)')]);

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
    expect(visualizes).toEqual([new Visualize('avg(span.duration)')]);

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([new Visualize('avg(span.self_time)')]);

    expect(fields).toEqual([
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
      'span.self_time',
    ]);

    // try adding a new chart
    await userEvent.click(within(section).getByRole('button', {name: 'Add Chart'}));
    expect(visualizes).toEqual([
      new Visualize('avg(span.self_time)'),
      new Visualize('count(span.duration)'),
    ]);

    // delete second chart
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[1]!);
    expect(visualizes).toEqual([new Visualize('avg(span.self_time)')]);

    // only one left so we hide the delete button
    expect(within(section).queryByLabelText('Remove Overlay')).not.toBeInTheDocument();
  });

  it('allows changing group bys', async function () {
    let groupBys: any;

    function Component() {
      groupBys = useExploreGroupBys();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    let options: HTMLElement[];
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

    // last one so remove column button is hidden
    expect(within(section).queryByLabelText('Remove Column')).not.toBeInTheDocument();
  });

  it('switches to aggregates mode when modifying group bys', async function () {
    let groupBys: any;
    let mode: any;

    function Component() {
      groupBys = useExploreGroupBys();
      mode = useExploreMode();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
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
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    expect(mode).toEqual(Mode.SAMPLES);
    expect(groupBys).toEqual(['']);

    const section = screen.getByTestId('section-group-by');

    await userEvent.click(within(section).getByRole('button', {name: 'Add Group'}));

    expect(mode).toEqual(Mode.AGGREGATE);
    expect(groupBys).toEqual(['', '']);
  });

  it('allows changing sort by in samples mode', async function () {
    let sortBys: any;
    function Component() {
      sortBys = useExploreSortBys();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
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

  it('allows changing sort by in aggregates mode', async function () {
    let sortBys: any;
    let setMode: any;
    function Component() {
      setMode = useSetExploreMode();
      sortBys = useExploreSortBys();
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    act(() => setMode(Mode.AGGREGATE));

    const visualizeSection = screen.getByTestId('section-visualizes');

    // try changing the aggregate
    await userEvent.click(within(visualizeSection).getByRole('button', {name: 'count'}));
    await userEvent.click(within(visualizeSection).getByRole('option', {name: 'avg'}));

    // try changing the field
    await userEvent.click(
      within(visualizeSection).getByRole('button', {name: 'span.duration'})
    );
    await userEvent.click(
      within(visualizeSection).getByRole('option', {name: 'span.self_time'})
    );

    await userEvent.click(
      within(visualizeSection).getByRole('button', {
        name: 'Add Chart',
      })
    );

    const section = screen.getByTestId('section-sort-by');

    // this is the default
    expect(
      within(section).getByRole('button', {name: 'avg(span.self_time)'})
    ).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'avg(span.self_time)', kind: 'desc'}]);

    // check the default field options
    const fields = ['avg(span.self_time)', 'count(spans)'];
    await userEvent.click(
      within(section).getByRole('button', {name: 'avg(span.self_time)'})
    );
    const fieldOptions = await within(section).findAllByRole('option');
    expect(fieldOptions).toHaveLength(fields.length);
    fieldOptions.forEach((option, i) => {
      expect(option).toHaveTextContent(fields[i]!);
    });

    // try changing the field
    await userEvent.click(
      within(section).getByRole('option', {name: 'avg(span.self_time)'})
    );
    expect(
      within(section).getByRole('button', {name: 'avg(span.self_time)'})
    ).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'avg(span.self_time)', kind: 'desc'}]);

    // check the kind options
    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    const kindOptions = await within(section).findAllByRole('option');
    expect(kindOptions).toHaveLength(2);
    expect(kindOptions[0]).toHaveTextContent('Desc');
    expect(kindOptions[1]).toHaveTextContent('Asc');
  });

  it('allows for different sort bys on samples and aggregates mode', async function () {
    let sortBys: any;
    let setMode: any;
    function Component() {
      setMode = useSetExploreMode();
      sortBys = useExploreSortBys();
      return <ExploreToolbar />;
    }

    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>
    );

    const section = screen.getByTestId('section-sort-by');

    expect(sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);

    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));

    expect(sortBys).toEqual([{field: 'timestamp', kind: 'asc'}]);

    act(() => setMode(Mode.AGGREGATE));

    expect(sortBys).toEqual([{field: 'count(span.duration)', kind: 'desc'}]);

    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));

    expect(sortBys).toEqual([{field: 'count(span.duration)', kind: 'asc'}]);

    act(() => setMode(Mode.SAMPLES));
    expect(sortBys).toEqual([{field: 'timestamp', kind: 'asc'}]);

    act(() => setMode(Mode.AGGREGATE));
    expect(sortBys).toEqual([{field: 'count(span.duration)', kind: 'asc'}]);
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    const section = screen.getByTestId('section-save-as');

    await userEvent.click(within(section).getByText(/Compare/));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/traces/compare/',
      query: expect.objectContaining({
        queries: [
          '{"chartType":0,"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["count(span.duration)"]}',
          '{"fields":["id","span.duration","timestamp"],"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["count(span.duration)"]}',
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    const section = screen.getByTestId('section-save-as');

    await userEvent.click(within(section).getByText(/Save as/));
    await userEvent.hover(
      within(section).getByRole('menuitemradio', {name: 'An Alert for'})
    );
    await userEvent.click(
      await within(section).findByRole('menuitemradio', {name: 'count(spans)'})
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname:
        '/organizations/org-slug/alerts/new/metric/?aggregate=count%28span.duration%29&dataset=events_analytics_platform&eventTypes=transaction&interval=1h&project=proj-slug&query=&statsPeriod=7d',
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
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
                fields: [],
                name: '',
                orderby: '',
              },
            ],
            title: 'Custom Widget',
            widgetType: 'spans',
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );
    screen.getByText('Save as\u2026');
    const section = screen.getByTestId('section-sort-by');
    await userEvent.click(within(section).getByRole('button', {name: 'Desc'}));
    await userEvent.click(within(section).getByRole('option', {name: 'Asc'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          aggregateSort: ['count(span.duration)'],
        }),
      })
    );

    // Simulate navigation from sort change
    router.location.query.aggregateSort = ['count(span.duration)'];
    router.push(router.location);
    render(
      <PageParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <Component />
        </TraceItemAttributeProvider>
      </PageParamsProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });
});
