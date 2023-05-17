import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import ConfigStore from 'sentry/stores/configStore';

const {organization, routerContext} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  project: undefined,
  projects: [
    {id: '1', slug: 'project-1', isMember: true},
    {id: '2', slug: 'project-2', isMember: true},
    {id: '3', slug: 'project-3', isMember: false},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
      query: {},
    },
    params: {},
  },
});

describe('TimeRangeSelector', function () {
  const onChange = jest.fn();

  function getComponent(props = {}) {
    return <TimeRangeSelector showAbsolute showRelative onChange={onChange} {...props} />;
  }

  function renderComponent(props = {}) {
    return render(getComponent(props), {context: routerContext});
  }

  beforeEach(function () {
    ConfigStore.loadInitialData(
      TestStubs.Config({
        user: {options: {timezone: 'America/New_York'}},
      })
    );
    onChange.mockReset();
  });

  it('renders when given relative period', function () {
    renderComponent({relative: '9d'});
    expect(screen.getByRole('button', {name: '9D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', function () {
    render(<TimeRangeSelector relative="1y" />, {context: routerContext, organization});
    expect(screen.getByRole('button', {name: 'Invalid Period'})).toBeInTheDocument();
  });

  it('hides relative options', async function () {
    renderComponent({showRelative: false, start: '0', end: '0'});

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    // Ensure none of the relative options are shown
    expect(screen.queryByRole('option', {name: 'Last 1 hour'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 24 hours'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 7 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 14 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 30 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 90 days'})).not.toBeInTheDocument();

    // Absolute selector is shown
    expect(screen.getByTestId('date-range')).toBeInTheDocument();
  });

  it('hides absolute selector', async function () {
    renderComponent({showAbsolute: false});

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    // Absolute option & selector are shown
    expect(screen.queryByRole('option', {name: 'Absolute date'})).not.toBeInTheDocument();
    expect(screen.queryByTestId('date-range')).not.toBeInTheDocument();
  });

  it('can select an absolute date range', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));
    expect(screen.getByTestId('date-range')).toBeInTheDocument();

    const fromDateInput = screen.getByTestId('date-range-primary-from');
    const toDateInput = screen.getByTestId('date-range-primary-to');
    expect(fromDateInput).toHaveValue('2017-10-02');
    expect(toDateInput).toHaveValue('2017-10-16');
    expect(screen.getByTestId('startTime')).toHaveValue('22:41');
    expect(screen.getByTestId('endTime')).toHaveValue('22:41');

    fireEvent.change(fromDateInput, {target: {value: '2017-10-03'}});
    fireEvent.change(toDateInput, {target: {value: '2017-10-04'}});

    // Selecting new date range resets time inputs to start/end of day
    expect(screen.getByTestId('startTime')).toHaveValue('00:00');
    expect(screen.getByTestId('endTime')).toHaveValue('23:59');

    // onChange is called after clicking Apply
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-03T00:00:00'), // local time
      end: new Date('2017-10-04T23:59:59'), // local time
      utc: false,
    });
  });

  it('can select an absolute range with utc enabled', async function () {
    renderComponent({utc: true});

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));
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
    expect(screen.getByTestId('startTime')).toHaveValue('00:00');
    expect(screen.getByTestId('endTime')).toHaveValue('23:59');

    // onChange is called after clicking Apply
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-03T00:00:00Z'), // utc time
      end: new Date('2017-10-04T23:59:59Z'), // utc time
      utc: true,
    });
  });

  it('keeps time inputs focused while interacting with them', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    await userEvent.click(screen.getByTestId('startTime'));
    fireEvent.change(screen.getByTestId('startTime'), {target: {value: '05:00'}});
    expect(screen.getByTestId('startTime')).toHaveFocus();

    await userEvent.click(screen.getByTestId('endTime'));
    fireEvent.change(screen.getByTestId('endTime'), {target: {value: '05:00'}});
    expect(screen.getByTestId('endTime')).toHaveFocus();
  });

  it('switches from relative to absolute and then toggling UTC (starting with UTC)', async function () {
    renderComponent({relative: '7d', utc: true});

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    // Local time is 22:41:20-0500 -- this is what date picker should show
    expect(screen.getByTestId('startTime')).toHaveValue('22:41');
    expect(screen.getByTestId('endTime')).toHaveValue('22:41');

    await userEvent.click(screen.getByRole('checkbox', {name: 'UTC'}));

    // onChange is called after clicking Apply
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: false,
    });
  });

  it('switches from relative to absolute and then toggling UTC (starting with non-UTC)', async function () {
    renderComponent({relative: '7d', utc: false});

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    // Local time is 22:41:20-0500 -- this is what date picker should show
    expect(screen.getByTestId('startTime')).toHaveValue('22:41');
    expect(screen.getByTestId('endTime')).toHaveValue('22:41');

    await userEvent.click(screen.getByRole('checkbox', {name: 'UTC'}));

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });
  });

  it('uses the default absolute date', async function () {
    renderComponent({
      defaultAbsolute: {
        start: new Date('2017-10-10T00:00:00.000Z'),
        end: new Date('2017-10-17T23:59:59.000Z'),
      },
    });

    await userEvent.click(screen.getByRole('button', {expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    // Time inputs show local time
    expect(screen.getByTestId('startTime')).toHaveValue('20:00');
    expect(screen.getByTestId('endTime')).toHaveValue('19:59');
  });

  it('can select arbitrary relative time ranges', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '5');

    // With just the number "5", all unit options should be present
    expect(screen.getByRole('option', {name: 'Last 5 minutes'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 5 hours'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 5 days'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 5 weeks'})).toBeInTheDocument();

    await userEvent.type(input, 'd');

    // With "5d", only "Last 5 days" should be shown
    expect(screen.getByRole('option', {name: 'Last 5 days'})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: 'Last 5 minutes'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 5 hours'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 5 weeks'})).not.toBeInTheDocument();

    await userEvent.type(input, 'ays');

    // "5days" Should still show "Last 5 days" option
    expect(screen.getByText('Last 5 days')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: 'Last 5 days'}));
    expect(onChange).toHaveBeenLastCalledWith({
      relative: '5d',
      start: undefined,
      end: undefined,
    });
  });

  it('respects maxPickableDays for arbitrary time ranges', async () => {
    renderComponent({maxPickableDays: 30});

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '3');

    // With just the number "3", all unit options should be present
    expect(screen.getByRole('option', {name: 'Last 3 minutes'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 3 hours'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 3 days'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 3 weeks'})).toBeInTheDocument();

    await userEvent.type(input, '1');

    // With "31", days and weeks should not be suggested
    expect(screen.getByRole('option', {name: 'Last 31 minutes'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Last 31 hours'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 31 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 31 weeks'})).not.toBeInTheDocument();

    await userEvent.type(input, 'd');

    // "31d" should return nothing
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('cannot select arbitrary relative time ranges with disallowArbitraryRelativeRanges', async () => {
    renderComponent({disallowArbitraryRelativeRanges: true});

    await userEvent.click(screen.getByRole('button', {expanded: false}));

    const input = screen.getByRole('textbox');

    // Search filter still works normally
    await userEvent.type(input, '24');
    expect(screen.getByRole('option', {name: 'Last 24 hours'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 1 hour'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 7 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 14 days'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 90 days'})).not.toBeInTheDocument();

    // But no arbitrary relative range will be suggested
    await userEvent.type(input, '5');
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });
});
