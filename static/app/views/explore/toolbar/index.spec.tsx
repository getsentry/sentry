import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageParamsProvider,
  useExploreDataset,
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExplorePageParams,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {SpanTagsProvider} from '../contexts/spanTagsContext';

describe('ExploreToolbar', function () {
  const organization = OrganizationFixture();

  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
  });

  it('should not render dataset selector', function () {
    function Component() {
      return <ExploreToolbar />;
    }
    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );
    const section = screen.queryByTestId('section-dataset');
    expect(section).not.toBeInTheDocument();
  });

  it('allows changing datasets', async function () {
    let dataset: any;
    function Component() {
      dataset = useExploreDataset();
      return <ExploreToolbar extras={['dataset toggle']} />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    const section = screen.getByTestId('section-dataset');

    const eapSpans = within(section).getByRole('radio', {name: 'EAP Spans'});
    const rpcSpans = within(section).getByRole('radio', {name: 'EAP RPC Spans'});
    const indexedSpans = within(section).getByRole('radio', {name: 'Indexed Spans'});

    expect(eapSpans).toBeChecked();
    expect(rpcSpans).not.toBeChecked();
    expect(indexedSpans).not.toBeChecked();
    expect(dataset).toEqual(DiscoverDatasets.SPANS_EAP);

    await userEvent.click(rpcSpans);
    expect(eapSpans).not.toBeChecked();
    expect(rpcSpans).toBeChecked();
    expect(indexedSpans).not.toBeChecked();
    expect(dataset).toEqual(DiscoverDatasets.SPANS_EAP_RPC);

    await userEvent.click(indexedSpans);
    expect(eapSpans).not.toBeChecked();
    expect(rpcSpans).not.toBeChecked();
    expect(indexedSpans).toBeChecked();
    expect(dataset).toEqual(DiscoverDatasets.SPANS_INDEXED);
  });

  it('allows changing mode', async function () {
    let mode: any;
    function Component() {
      mode = useExploreMode();
      return <ExploreToolbar extras={['dataset toggle']} />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
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
      return <ExploreToolbar extras={['dataset toggle']} />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {disableRouterMocks: true}
    );

    const section = screen.getByTestId('section-mode');

    const samples = within(section).getByRole('radio', {name: 'Samples'});
    const aggregates = within(section).getByRole('radio', {name: 'Aggregates'});

    expect(fields).toEqual([
      'id',
      'project',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default

    // Add a group by, and leave one unselected
    await userEvent.click(aggregates);
    const groupBy = screen.getByTestId('section-group-by');
    await userEvent.click(within(groupBy).getByRole('button', {name: 'None'}));
    await userEvent.click(within(groupBy).getByRole('option', {name: 'release'}));
    expect(groupBys).toEqual(['release']);
    await userEvent.click(within(groupBy).getByRole('button', {name: 'Add Group'}));
    expect(groupBys).toEqual(['release', '']);

    await userEvent.click(samples);
    expect(fields).toEqual([
      'id',
      'project',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
      'release',
    ]); // default
  });

  it('allows changing visualizes', async function () {
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
      {disableRouterMocks: true}
    );

    const section = screen.getByTestId('section-visualizes');

    // this is the default
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['avg(span.duration)'],
      },
    ]);

    // try changing the field
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['avg(span.self_time)'],
      },
    ]);

    // try changing the aggregate
    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count'}));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.self_time)'],
      },
    ]);

    // try adding an overlay
    await userEvent.click(within(section).getByRole('button', {name: 'Add Series'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.self_time)', 'avg(span.self_time)'],
      },
    ]);

    // try adding a new chart
    await userEvent.click(within(section).getByRole('button', {name: 'Add Chart'}));
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['count(span.self_time)', 'avg(span.self_time)'],
      },
      {
        chartType: ChartType.LINE,
        label: 'B',
        yAxes: ['avg(span.duration)'],
      },
    ]);

    // delete first overlay
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[0]!);
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['avg(span.self_time)'],
      },
      {
        chartType: ChartType.LINE,
        label: 'B',
        yAxes: ['avg(span.duration)'],
      },
    ]);

    // delete second chart
    await userEvent.click(within(section).getAllByLabelText('Remove Overlay')[1]!);
    expect(visualizes).toEqual([
      {
        chartType: ChartType.LINE,
        label: 'A',
        yAxes: ['avg(span.self_time)'],
      },
    ]);

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
      {disableRouterMocks: true}
    );

    const section = screen.getByTestId('section-group-by');

    expect(within(section).getByRole('button', {name: 'None'})).toBeInTheDocument();
    expect(groupBys).toEqual(['']);

    // disabled in the samples mode
    expect(within(section).getByRole('button', {name: 'None'})).toBeDisabled();

    // click the aggregates mode to enable
    await userEvent.click(
      within(screen.getByTestId('section-mode')).getByRole('radio', {
        name: 'Aggregates',
      })
    );

    expect(within(section).getByRole('button', {name: 'None'})).toBeEnabled();
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    const groupByOptions1 = await within(section).findAllByRole('option');
    expect(groupByOptions1.length).toBeGreaterThan(0);

    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(groupBys).toEqual(['span.op']);

    await userEvent.click(within(section).getByRole('button', {name: 'Add Group'}));
    expect(groupBys).toEqual(['span.op', '']);

    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    const groupByOptions2 = await within(section).findAllByRole('option');
    expect(groupByOptions2.length).toBeGreaterThan(0);

    await userEvent.click(
      within(section).getByRole('option', {name: 'span.description'})
    );
    expect(groupBys).toEqual(['span.op', 'span.description']);

    await userEvent.click(within(section).getAllByLabelText('Remove Column')[0]!);
    expect(groupBys).toEqual(['span.description']);

    // only 1 left but it's not empty
    expect(within(section).getByLabelText('Remove Column')).toBeEnabled();

    await userEvent.click(within(section).getByLabelText('Remove Column'));
    expect(groupBys).toEqual(['']);

    // last one and it's empty
    expect(within(section).getByLabelText('Remove Column')).toBeDisabled();
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
      {disableRouterMocks: true}
    );

    const section = screen.getByTestId('section-sort-by');

    // this is the default
    expect(within(section).getByRole('button', {name: 'timestamp'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
    expect(sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);

    // check the default field options
    const fields = [
      'id',
      'project',
      'span.description',
      'span.duration',
      'span.op',
      'timestamp',
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
      {disableRouterMocks: true}
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
          {
            chartType: ChartType.LINE,
            label: 'A',
            yAxes: ['avg(span.duration)'],
          },
          {
            chartType: ChartType.LINE,
            label: 'B',
            yAxes: ['p50(span.duration)'],
          },
        ],
      })
    );
  });
});
