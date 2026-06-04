import type {ReactNode} from 'react';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {
  useSetQueryParamsMode,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

jest.mock('sentry/actionCreators/modal');

describe('AddToDashboardButton', () => {
  let setMode: ReturnType<typeof useSetQueryParamsMode>;
  let setVisualizes: ReturnType<typeof useSetQueryParamsVisualizes>;

  function TestPage({visualizeIndex}: {visualizeIndex: number}) {
    setMode = useSetQueryParamsMode();
    setVisualizes = useSetQueryParamsVisualizes();
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
      <Wrapper>
        <TestPage visualizeIndex={0} />
      </Wrapper>
    );

    await userEvent.click(screen.getByText('Add to Dashboard'));

    // The table columns are encoded as the fields for the defaultWidgetQuery
    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widgets: [
          {
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
        ],
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
        <Wrapper>
          <TestPage visualizeIndex={1} />
        </Wrapper>
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
          widgets: [
            {
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
          ],
        })
      );
    }
  );

  it('opens the dashboard modal with the correct query based on the visualize index', async () => {
    render(
      <Wrapper>
        <TestPage visualizeIndex={1} />
      </Wrapper>
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
        widgets: [
          {
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
        ],
      })
    );
  });

  it('uses the yAxes for the aggregate mode', async () => {
    render(
      <Wrapper>
        <TestPage visualizeIndex={0} />
      </Wrapper>
    );

    act(() => setMode(Mode.AGGREGATE));

    await userEvent.click(screen.getByText('Add to Dashboard'));

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widgets: [
          {
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
        ],
      })
    );
  });

  it('takes the first 3 yAxes', async () => {
    render(
      <Wrapper>
        <TestPage visualizeIndex={0} />
      </Wrapper>
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
        widgets: [
          {
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
        ],
      })
    );
  });
});
