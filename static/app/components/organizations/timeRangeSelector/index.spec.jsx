import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TimeRangeSelector from 'sentry/components/organizations/timeRangeSelector';
import ConfigStore from 'sentry/stores/configStore';

describe('TimeRangeSelector', function () {
  const onChange = jest.fn();
  const routerContext = TestStubs.routerContext();
  const organization = TestStubs.Organization();

  function getComponent(props = {}) {
    return (
      <TimeRangeSelector
        showAbsolute
        showRelative
        onChange={onChange}
        organization={organization}
        {...props}
      />
    );
  }

  function renderComponent(props = {}) {
    return render(getComponent(props), {context: routerContext});
  }

  beforeEach(function () {
    ConfigStore.loadInitialData({
      user: {options: {timezone: 'America/New_York'}},
    });
    onChange.mockReset();
  });

  it('renders when given relative period not in dropdown', async function () {
    render(
      <TimeRangeSelector
        organization={organization}
        showAbsolute={false}
        showRelative={false}
        relative="9d"
      />,
      {context: routerContext}
    );
    expect(screen.getByText('Last 9 days')).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async function () {
    render(
      <TimeRangeSelector
        organization={organization}
        showAbsolute={false}
        showRelative={false}
        relative="1y"
      />,
      {context: routerContext}
    );
    expect(screen.getByText('Invalid period')).toBeInTheDocument();
  });

  it('hides relative and absolute selectors', async function () {
    render(
      <TimeRangeSelector
        organization={organization}
        showAbsolute={false}
        showRelative={false}
      />,
      {context: routerContext}
    );
    await userEvent.click(screen.getByRole('button'));

    // Ensure none of the relative options are shown
    expect(screen.queryByTestId('1h')).not.toBeInTheDocument();
    expect(screen.queryByTestId('24h')).not.toBeInTheDocument();
    expect(screen.queryByTestId('7d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('14d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('30d')).not.toBeInTheDocument();
    expect(screen.queryByTestId('90d')).not.toBeInTheDocument();

    // Ensure absolute option not shown
    expect(screen.queryByTestId('absolute')).not.toBeInTheDocument();
  });

  it('does not open selector menu when disabled', async function () {
    renderComponent({disabled: true});
    await userEvent.click(screen.getByRole('button'));

    // Dropdown not open
    expect(screen.queryByText(/last hour/i)).not.toBeInTheDocument();
  });

  it('can select an absolute date range', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('date-range')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('absolute'));
    const newProps = {
      relative: null,
      start: new Date('2017-10-03T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
    };
    expect(onChange).toHaveBeenLastCalledWith(newProps);

    expect(await screen.findByTestId('date-range')).toBeInTheDocument();

    const fromDateInput = screen.getByTestId('date-range-primary-from');
    const toDateInput = screen.getByTestId('date-range-primary-to');

    expect(fromDateInput).toHaveValue('2017-10-02');
    expect(toDateInput).toHaveValue('2017-10-16');

    expect(screen.getByTestId('startTime')).toHaveValue('22:41');
    expect(screen.getByTestId('endTime')).toHaveValue('22:41');

    fireEvent.change(fromDateInput, {target: {value: '2017-10-03'}});
    fireEvent.change(toDateInput, {target: {value: '2017-10-04'}});

    // Selecting new date range resets time inputs to start/end of day
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-03T00:00:00'), // local time
      end: new Date('2017-10-04T23:59:59'), // local time
    });
    expect(screen.getByTestId('startTime')).toHaveValue('00:00');
    expect(screen.getByTestId('endTime')).toHaveValue('23:59');
  });

  it('can select an absolute range with utc enabled', async function () {
    renderComponent({utc: true});

    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('date-range')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('absolute'));
    const newProps = {
      relative: null,
      start: new Date('2017-10-02T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    };
    expect(onChange).toHaveBeenLastCalledWith(newProps);

    expect(await screen.findByTestId('date-range')).toBeInTheDocument();

    const fromDateInput = screen.getByTestId('date-range-primary-from');
    const toDateInput = screen.getByTestId('date-range-primary-to');

    expect(fromDateInput).toHaveValue('2017-10-02');
    expect(toDateInput).toHaveValue('2017-10-16');

    expect(screen.getByTestId('startTime')).toHaveValue('22:41');
    expect(screen.getByTestId('endTime')).toHaveValue('22:41');

    fireEvent.change(fromDateInput, {target: {value: '2017-10-03'}});
    fireEvent.change(toDateInput, {target: {value: '2017-10-04'}});

    // Selecting new date range resets time inputs to start/end of day
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-03T00:00:00Z'), // utc time
      end: new Date('2017-10-04T23:59:59Z'), // utc time
      utc: true,
    });
    expect(screen.getByTestId('startTime')).toHaveValue('00:00');
    expect(screen.getByTestId('endTime')).toHaveValue('23:59');
  });

  it('keeps time inputs focused while interacting with them', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
    await screen.findByTestId('date-range');

    await userEvent.click(screen.getByTestId('startTime'));
    fireEvent.change(screen.getByTestId('startTime'), {target: {value: '05:00'}});

    expect(screen.getByTestId('startTime')).toHaveFocus();

    await userEvent.click(screen.getByTestId('endTime'));
    fireEvent.change(screen.getByTestId('endTime'), {target: {value: '05:00'}});

    expect(screen.getByTestId('endTime')).toHaveFocus();
  });

  it('switches from relative to absolute while maintaining equivalent date range', async function () {
    const {rerender} = renderComponent({
      relative: '7d',
      utc: false,
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: false,
    });

    await userEvent.click(screen.getByTestId('14d'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: '14d',
      start: undefined,
      end: undefined,
    });

    rerender(
      getComponent({
        relative: '14d',
        utc: false,
      })
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-03T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: false,
    });
  });

  it('switches from relative to absolute while maintaining equivalent date range (in utc)', async function () {
    const {rerender} = renderComponent({
      relative: '7d',
      utc: true,
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });

    await userEvent.click(screen.getByTestId('14d'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: '14d',
      start: undefined,
      end: undefined,
    });

    rerender(
      getComponent({
        relative: '14d',
        utc: true,
      })
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-02T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });
  });

  it('switches from relative to absolute and then toggling UTC (starting with UTC)', async function () {
    renderComponent({
      relative: '7d',
      utc: true,
    });
    await userEvent.click(screen.getByRole('button'));
    // Local time is 22:41:20-0500 -- this is what date picker should show
    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: false,
    });

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: true,
    });
  });

  it('switches from relative to absolute and then toggling UTC (starting with non-UTC)', async function () {
    renderComponent({
      relative: '7d',
      utc: false,
    });
    await userEvent.click(screen.getByRole('button'));

    await userEvent.click(await screen.findByTestId('absolute'));
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000-0400'),
      end: new Date('2017-10-16T22:41:20.000-0400'),
      utc: false,
    });

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: true,
    });

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: false,
    });
  });

  it('maintains time when switching UTC to local time', async function () {
    // Times should never change when changing UTC option
    // Instead, the utc flagged is used when querying to create proper date

    let state;
    const {rerender} = renderComponent({
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: true,
    });
    await userEvent.click(screen.getByRole('button'));

    // Local
    await userEvent.click(screen.getByRole('checkbox'));
    state = {
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: false,
    };
    expect(onChange).toHaveBeenLastCalledWith(state);

    rerender(getComponent(state));

    // UTC
    await userEvent.click(screen.getByRole('checkbox'));
    state = {
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: true,
    };
    expect(onChange).toHaveBeenLastCalledWith(state);

    rerender(getComponent(state));

    // Local
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: false,
    });
  });

  it('deselects default filter when absolute date selected', async function () {
    renderComponent({
      relative: '14d',
      utc: false,
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));
  });

  it('uses the default absolute date', async function () {
    renderComponent({
      defaultAbsolute: {
        start: new Date('2017-10-10T00:00:00.000Z'),
        end: new Date('2017-10-17T23:59:59.000Z'),
      },
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));

    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
    });
  });

  it('uses the current absolute date if provided', async function () {
    renderComponent({
      start: new Date('2022-06-12T00:00:00.000Z'),
      end: new Date('2022-06-14T00:00:00.000Z'),
    });

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByTestId('absolute'));

    // On change should not be called because start/end did not change
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can select arbitrary relative time ranges', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button'));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '5');

    // With just the number "5", all unit options should be present
    expect(screen.getByText('Last 5 minutes')).toBeInTheDocument();
    expect(screen.getByText('Last 5 hours')).toBeInTheDocument();
    expect(screen.getByText('Last 5 days')).toBeInTheDocument();
    expect(screen.getByText('Last 5 weeks')).toBeInTheDocument();

    await userEvent.type(input, 'd');

    // With "5d", only "Last 5 days" should be shown
    expect(screen.getByText('Last 5 days')).toBeInTheDocument();
    expect(screen.queryByText('Last 5 minutes')).not.toBeInTheDocument();
    expect(screen.queryByText('Last 5 hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Last 5 weeks')).not.toBeInTheDocument();

    await userEvent.type(input, 'ays');

    // "5days" Should still show "Last 5 days" option
    expect(screen.getByText('Last 5 days')).toBeInTheDocument();

    await userEvent.type(input, '{Enter}');

    expect(onChange).toHaveBeenLastCalledWith({
      relative: '5d',
      start: undefined,
      end: undefined,
    });
  });

  it('respects maxPickableDays for arbitrary time ranges', async () => {
    renderComponent({maxPickableDays: 30});

    await userEvent.click(screen.getByRole('button'));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '3');

    // With just the number "3", all unit options should be present
    expect(screen.getByText('Last 3 minutes')).toBeInTheDocument();
    expect(screen.getByText('Last 3 hours')).toBeInTheDocument();
    expect(screen.getByText('Last 3 days')).toBeInTheDocument();
    expect(screen.getByText('Last 3 weeks')).toBeInTheDocument();

    await userEvent.type(input, '1');

    // With "31", days and weeks should not be suggested
    expect(screen.getByText('Last 31 minutes')).toBeInTheDocument();
    expect(screen.getByText('Last 31 hours')).toBeInTheDocument();
    expect(screen.queryByText('Last 31 days')).not.toBeInTheDocument();
    expect(screen.queryByText('Last 31 weeks')).not.toBeInTheDocument();

    await userEvent.type(input, 'd');

    // "31d" should return nothing
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('cannot select arbitrary relative time ranges with disallowArbitraryRelativeRanges', async () => {
    renderComponent({disallowArbitraryRelativeRanges: true});

    await userEvent.click(screen.getByRole('button'));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '5');

    expect(screen.getByText('No items found')).toBeInTheDocument();

    await userEvent.type(input, '{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });
});
