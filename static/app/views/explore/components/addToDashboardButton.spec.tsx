import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {AddToDashboardButton} from 'sentry/views/explore/components/addToDashboardButton';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

jest.mock('sentry/actionCreators/modal');
jest.mock('sentry/views/explore/hooks/useVisualizes');
jest.mock('sentry/views/explore/hooks/useResultsMode');

describe('AddToDashboardButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(useVisualizes).mockReturnValue([
      [
        {
          yAxes: ['avg(span.duration)'],
          chartType: ChartType.LINE,
          label: 'Custom Explore Widget',
        },
      ],
      jest.fn(),
    ]);

    jest.mocked(useResultMode).mockReturnValue(['samples', jest.fn()]);
  });

  it('renders', async () => {
    render(<AddToDashboardButton visualizeIndex={0} />);
    await userEvent.hover(screen.getByLabelText('Add to Dashboard'));
    expect(await screen.findByText('Add to Dashboard')).toBeInTheDocument();
  });

  it('opens the dashboard modal with the correct query for samples mode', async () => {
    render(<AddToDashboardButton visualizeIndex={0} />);
    await userEvent.click(screen.getByLabelText('Add to Dashboard'));

    // The table columns are encoded as the fields for the defaultWidgetQuery
    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Explore Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['avg(span.duration)'],
              columns: [],
              fields: ['avg(span.duration)'],
              conditions: '',
              orderby: '-timestamp',
              name: '',
            },
          ],
        },

        // For Open in Widget Builder
        widgetAsQueryParams: expect.objectContaining({
          dataset: WidgetType.SPANS,
          defaultTableColumns: [
            'span_id',
            'project',
            'span.op',
            'span.description',
            'span.duration',
            'timestamp',
          ],
          defaultTitle: 'Custom Explore Widget',
          defaultWidgetQuery:
            'name=&aggregates=avg(span.duration)&columns=&fields=avg(span.duration)&conditions=&orderby=-timestamp',
          displayType: DisplayType.LINE,
          field: [
            'span_id',
            'project',
            'span.op',
            'span.description',
            'span.duration',
            'timestamp',
          ],
        }),
      })
    );
  });

  it('opens the dashboard modal with the correct query based on the visualize index', async () => {
    // Mock a second visualize object
    jest.mocked(useVisualizes).mockReturnValue([
      [
        {
          yAxes: ['avg(span.duration)'],
          chartType: ChartType.LINE,
          label: 'Custom Explore Widget',
        },
        {
          yAxes: ['max(span.duration)'],
          chartType: ChartType.LINE,
          label: 'Custom Explore Widget',
        },
      ],
      jest.fn(),
    ]);

    render(<AddToDashboardButton visualizeIndex={1} />);
    await userEvent.click(screen.getByLabelText('Add to Dashboard'));

    // The group by and the yAxes are encoded as the fields for the defaultTableQuery
    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Explore Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['max(span.duration)'],
              columns: [],
              fields: ['max(span.duration)'],
              conditions: '',
              orderby: '-timestamp',
              name: '',
            },
          ],
        },

        // For Open in Widget Builder
        widgetAsQueryParams: expect.objectContaining({
          dataset: WidgetType.SPANS,
          defaultTableColumns: [
            'span_id',
            'project',
            'span.op',
            'span.description',
            'span.duration',
            'timestamp',
          ],
          defaultTitle: 'Custom Explore Widget',
          defaultWidgetQuery:
            'name=&aggregates=max(span.duration)&columns=&fields=max(span.duration)&conditions=&orderby=-timestamp',
          displayType: DisplayType.LINE,
          field: [
            'span_id',
            'project',
            'span.op',
            'span.description',
            'span.duration',
            'timestamp',
          ],
        }),
      })
    );
  });

  it('uses the yAxes for the aggregate mode', async () => {
    jest.mocked(useResultMode).mockReturnValue(['aggregate', jest.fn()]);

    render(<AddToDashboardButton visualizeIndex={0} />);
    await userEvent.click(screen.getByLabelText('Add to Dashboard'));

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Explore Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: ['avg(span.duration)'],
              columns: [],
              fields: ['avg(span.duration)'],
              conditions: '',
              orderby: '-avg(span.duration)',
              name: '',
            },
          ],
        },

        // For Open in Widget Builder
        widgetAsQueryParams: expect.objectContaining({
          dataset: WidgetType.SPANS,
          defaultTableColumns: ['avg(span.duration)'],
          defaultTitle: 'Custom Explore Widget',
          defaultWidgetQuery:
            'name=&aggregates=avg(span.duration)&columns=&fields=avg(span.duration)&conditions=&orderby=-avg(span.duration)',
          displayType: DisplayType.LINE,
          field: ['avg(span.duration)'],
        }),
      })
    );
  });

  it('takes the first 3 yAxes', async () => {
    jest.mocked(useResultMode).mockReturnValue(['aggregate', jest.fn()]);
    jest.mocked(useVisualizes).mockReturnValue([
      [
        {
          yAxes: [
            'avg(span.duration)',
            'max(span.duration)',
            'min(span.duration)',
            'p90(span.duration)',
          ],
          chartType: ChartType.LINE,
          label: 'Custom Explore Widget',
        },
      ],
      jest.fn(),
    ]);

    render(<AddToDashboardButton visualizeIndex={0} />);
    await userEvent.click(screen.getByLabelText('Add to Dashboard'));

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        // For Add + Stay on Page
        widget: {
          title: 'Custom Explore Widget',
          displayType: DisplayType.LINE,
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.SPANS,
          queries: [
            {
              aggregates: [
                'avg(span.duration)',
                'max(span.duration)',
                'min(span.duration)',
              ],
              columns: [],
              fields: ['avg(span.duration)', 'max(span.duration)', 'min(span.duration)'],
              conditions: '',
              orderby: '-avg(span.duration)',
              name: '',
            },
          ],
        },

        // For Open in Widget Builder
        widgetAsQueryParams: expect.objectContaining({
          dataset: WidgetType.SPANS,
          defaultTableColumns: [
            'avg(span.duration)',
            'max(span.duration)',
            'min(span.duration)',
          ],
          defaultTitle: 'Custom Explore Widget',
          defaultWidgetQuery:
            'name=&aggregates=avg(span.duration)%2Cmax(span.duration)%2Cmin(span.duration)&columns=&fields=avg(span.duration)%2Cmax(span.duration)%2Cmin(span.duration)&conditions=&orderby=-avg(span.duration)',
          displayType: DisplayType.LINE,
          field: ['avg(span.duration)', 'max(span.duration)', 'min(span.duration)'],
        }),
      })
    );
  });
});
