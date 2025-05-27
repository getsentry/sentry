import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  PageParamsProvider,
  useSetExploreMode,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/actionCreators/modal');

describe('AddToDashboardButton', () => {
  let setMode: ReturnType<typeof useSetExploreMode>;
  let setVisualizes: ReturnType<typeof useSetExploreVisualizes>;

  function TestPage({visualizeIndex}: {visualizeIndex: number}) {
    setMode = useSetExploreMode();
    setVisualizes = useSetExploreVisualizes();
    const {addToDashboard} = useAddToDashboard();
    return (
      <button onClick={() => addToDashboard(visualizeIndex)}>Add to Dashboard</button>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the dashboard modal with the correct query for samples mode', async () => {
    render(
      <PageParamsProvider>
        <TestPage visualizeIndex={0} />
      </PageParamsProvider>
    );

    await userEvent.click(screen.getByText('Add to Dashboard'));

    // The table columns are encoded as the fields for the defaultWidgetQuery
    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.BAR,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['count(span.duration)'],
              columns: [],
              fields: [],
              conditions: '',
              orderby: '',
              name: '',
            },
          ],
        },
      })
    );
  });

  it.each([
    {
      chartType: ChartType.AREA,
      expectedDisplayType: DisplayType.AREA,
    },
    {
      chartType: ChartType.BAR,
      expectedDisplayType: DisplayType.BAR,
    },
    {
      chartType: ChartType.LINE,
      expectedDisplayType: DisplayType.LINE,
    },
  ])(
    'opens the dashboard modal with display type $expectedDisplayType for chart type $chartType',
    async ({chartType, expectedDisplayType}) => {
      render(
        <PageParamsProvider>
          <TestPage visualizeIndex={1} />
        </PageParamsProvider>
      );

      act(() =>
        setVisualizes([
          {
            yAxes: ['avg(span.duration)'],
            chartType: ChartType.AREA,
          },
          {
            yAxes: ['max(span.duration)'],
            chartType,
          },
        ])
      );

      await userEvent.click(screen.getByText('Add to Dashboard'));

      // The group by and the yAxes are encoded as the fields for the defaultTableQuery
      expect(openAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          // For Add + Stay on Page
          widget: {
            title: 'Custom Widget',
            displayType: expectedDisplayType,
            interval: undefined,
            limit: undefined,
            widgetType: WidgetType.SPANS,
            queries: [
              {
                aggregates: ['max(span.duration)'],
                columns: [],
                fields: [],
                conditions: '',
                orderby: '',
                name: '',
              },
            ],
          },
        })
      );
    }
  );

  it('opens the dashboard modal with the correct query based on the visualize index', async () => {
    render(
      <PageParamsProvider>
        <TestPage visualizeIndex={1} />
      </PageParamsProvider>
    );

    act(() =>
      setVisualizes([
        {
          yAxes: ['avg(span.duration)'],
          chartType: ChartType.LINE,
        },
        {
          yAxes: ['max(span.duration)'],
          chartType: ChartType.LINE,
        },
      ])
    );

    await userEvent.click(screen.getByText('Add to Dashboard'));

    // The group by and the yAxes are encoded as the fields for the defaultTableQuery
    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['max(span.duration)'],
              columns: [],
              fields: [],
              conditions: '',
              orderby: '',
              name: '',
            },
          ],
        },
      })
    );
  });

  it('uses the yAxes for the aggregate mode', async () => {
    render(
      <PageParamsProvider>
        <TestPage visualizeIndex={0} />
      </PageParamsProvider>
    );

    act(() => setMode(Mode.AGGREGATE));

    await userEvent.click(screen.getByText('Add to Dashboard'));

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.BAR,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['count(span.duration)'],
              columns: [],
              fields: [],
              conditions: '',
              orderby: '-count(span.duration)',
              name: '',
            },
          ],
        },
      })
    );
  });

  it('takes the first 3 yAxes', async () => {
    render(
      <PageParamsProvider>
        <TestPage visualizeIndex={0} />
      </PageParamsProvider>
    );

    act(() => setMode(Mode.AGGREGATE));
    act(() =>
      setVisualizes([
        {
          yAxes: [
            'avg(span.duration)',
            'max(span.duration)',
            'min(span.duration)',
            'p90(span.duration)',
          ],
          chartType: ChartType.LINE,
        },
      ])
    );

    await userEvent.click(screen.getByText('Add to Dashboard'));

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: [
                // because the visualizes get flattend, we only take the first y axis
                'avg(span.duration)',
              ],
              columns: [],
              fields: [],
              conditions: '',
              orderby: '-avg(span.duration)',
              name: '',
            },
          ],
        },
      })
    );
  });
});
