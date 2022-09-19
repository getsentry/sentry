import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {addMetricsDataMock} from 'sentry-test/performance/addMetricsDataMock';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import ChartFooter from 'sentry/views/eventsV2/chartFooter';

function metricsCardinalityWrapped(
  children: React.ReactNode,
  organization: Organization,
  project: Project
) {
  const routerLocation: {query: {project?: number}} = {
    query: {project: parseInt(project.id, 10)},
  };

  const router = {
    location: routerLocation,
  };

  const initialData = initializeOrg({
    organization,
    projects: [project],
    project,
    router,
  });
  const location = initialData.router.location;
  return (
    <MetricsCardinalityProvider location={location} organization={organization}>
      {children}
    </MetricsCardinalityProvider>
  );
}

describe('EventsV2 > ChartFooter', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  let yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
  ];
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'count()'],
    projects: [project.id],
  });

  afterEach(function () {});

  it('renders yAxis option using OptionCheckboxSelector using entire yAxisValue', function () {
    const organization = TestStubs.Organization({
      features: [...features],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    const wrapper = mountWithTheme(
      metricsCardinalityWrapped(chartFooter, organization, project),
      initialData.routerContext
    );

    wrapper.update();

    const optionCheckboxSelector = wrapper.find('OptionSelector').last();
    expect(optionCheckboxSelector.props().title).toEqual(t('Y-Axis'));
    expect(optionCheckboxSelector.props().selected).toEqual(yAxisValue);
  });

  it('renders display limits with default limit when top 5 mode is selected', async function () {
    const organization = TestStubs.Organization({
      features,
    });
    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.TOP5}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    const wrapper = mountWithTheme(
      metricsCardinalityWrapped(chartFooter, organization, project),
      initialData.routerContext
    );

    await tick();
    wrapper.update();

    const optionSelector = wrapper.find('OptionSelector[title="Limit"]');
    expect(optionSelector.props().selected).toEqual('5');
  });

  it('renders single value y-axis dropdown selector on a Top display', function () {
    const organization = TestStubs.Organization({
      features,
    });
    let yAxis = ['count()'];

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxis}
        yAxisOptions={yAxisOptions}
        onAxisChange={newYAxis => (yAxis = newYAxis)}
        displayMode={DisplayModes.TOP5}
        displayOptions={[{label: DisplayModes.TOP5, value: DisplayModes.TOP5}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(metricsCardinalityWrapped(chartFooter, organization, project));

    userEvent.click(screen.getByText('count()'));
    userEvent.click(screen.getByText('failure_count()'));
    expect(yAxis).toEqual(['failure_count()']);
  });

  it('disables processed baseline toggle if metrics cardinality conditions not met', function () {
    const organization = TestStubs.Organization({
      features: [...features, 'discover-metrics-baseline'],
    });

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={['count()']}
        yAxisOptions={yAxisOptions}
        onAxisChange={jest.fn}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(metricsCardinalityWrapped(chartFooter, organization, project));

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeDisabled();
  });

  it('enables processed baseline toggle if metrics cardinality conditions met', function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 1,
    });

    const organization = TestStubs.Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'performance-transaction-name-only-search',
        'organizations:performance-transaction-name-only-search',
      ],
    });

    yAxisOptions = [
      {label: 'count()', value: 'count()'},
      {label: 'p50(measurements.lcp)', value: 'p50(measurements.lcp)'},
    ];

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={['p50(measurements.lcp)']}
        yAxisOptions={yAxisOptions}
        onAxisChange={jest.fn}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(metricsCardinalityWrapped(chartFooter, organization, project));

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeEnabled();
  });

  it('disables toggle if discover hits the events dataset', function () {
    addMetricsDataMock({
      metricsCount: 100,
      nullCount: 0,
      unparamCount: 1,
    });

    yAxisOptions = [
      {label: 'count()', value: 'count()'},
      {label: 'failure_count()', value: 'failure_count()'},
    ];

    const organization = TestStubs.Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'performance-transaction-name-only-search',
        'organizations:performance-transaction-name-only-search',
      ],
    });

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={['count()']}
        yAxisOptions={yAxisOptions}
        onAxisChange={jest.fn}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(metricsCardinalityWrapped(chartFooter, organization, project));

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeDisabled();
  });

  it('renders multi value y-axis dropdown selector on a non-Top display', function () {
    const organization = TestStubs.Organization({
      features,
    });
    let yAxis = ['count()'];

    const chartFooter = (
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxis}
        yAxisOptions={yAxisOptions}
        onAxisChange={newYAxis => (yAxis = newYAxis)}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        topEvents="5"
        showBaseline={false}
        setShowBaseline={() => undefined}
        eventView={eventView}
      />
    );

    render(metricsCardinalityWrapped(chartFooter, organization, project));

    userEvent.click(screen.getByText('count()'));
    userEvent.click(screen.getByText('failure_count()'));
    expect(yAxis).toEqual(['count()', 'failure_count()']);
  });
});
