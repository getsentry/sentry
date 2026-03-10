import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';

jest.mock('sentry/utils/useChartInterval');
jest.mock('sentry/views/explore/metrics/useSaveAsMetricItems');

const mockedUseChartInterval = jest.mocked(useChartInterval);
const mockedUseSaveAsMetricItems = jest.mocked(useSaveAsMetricItems);

describe('MetricSaveAs', () => {
  beforeEach(() => {
    mockedUseChartInterval.mockReturnValue(['1h', jest.fn(), []]);
  });

  it('keeps Save as enabled for multi-aggregate menu items', async () => {
    const items: MenuItemProps[] = [
      {
        key: 'save-query',
        textValue: 'New Query',
        label: <span>New Query</span>,
        onAction: jest.fn(),
      },
      {
        key: 'add-to-dashboard',
        textValue: 'Dashboard widget',
        label: <span>Dashboard widget</span>,
        isSubmenu: true,
        children: [
          {key: '0', textValue: 'p50(foo)', label: 'p50(foo)', onAction: jest.fn()},
          {key: '1', textValue: 'p75(foo)', label: 'p75(foo)', onAction: jest.fn()},
        ],
      },
    ];
    mockedUseSaveAsMetricItems.mockReturnValue(items);

    render(<MetricSaveAs />);

    const saveAsButton = screen.getByRole('button', {name: 'Save as'});
    expect(saveAsButton).toBeEnabled();
    expect(
      screen.queryByText(
        'Saving multi-aggregate metrics is not supported during early access.'
      )
    ).not.toBeInTheDocument();

    await userEvent.click(saveAsButton);
    expect(await screen.findByText('Dashboard widget')).toBeInTheDocument();
  });

  it('renders and executes a single direct action', async () => {
    const onAction = jest.fn();
    const items: MenuItemProps[] = [
      {
        key: 'save-query',
        textValue: 'New Query',
        label: <span>New Query</span>,
        onAction,
      },
    ];
    mockedUseSaveAsMetricItems.mockReturnValue(items);

    render(<MetricSaveAs />);

    const saveAsButton = screen.getByRole('button', {name: 'New Query'});
    expect(saveAsButton).toBeEnabled();

    await userEvent.click(saveAsButton);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
