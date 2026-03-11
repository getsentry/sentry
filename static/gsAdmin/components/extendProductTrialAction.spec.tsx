import moment from 'moment-timezone';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import ExtendProductTrialAction from 'admin/components/extendProductTrialAction';

describe('ExtendProductTrialAction', () => {
  const activeProductTrial = {
    category: DataCategory.REPLAYS,
    isStarted: true,
    reasonCode: 1001,
    startDate: moment().utc().subtract(10, 'days').format(),
    endDate: moment().utc().add(4, 'days').format(),
  };

  const defaultProps = {
    activeProductTrial,
    apiName: 'replays',
    trialName: 'Replays',
    confirm: jest.fn(),
    close: jest.fn(),
    disableConfirmButton: jest.fn(),
    setConfirmCallback: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default 14 days', () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    expect(screen.getByText(/Extend the/)).toBeInTheDocument();
    expect(screen.getByText('Replays')).toBeInTheDocument();
    expect(screen.getByDisplayValue('14')).toBeInTheDocument();
  });

  it('displays current trial end date in UTC', () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    const expectedCurrentDate = moment
      .utc(activeProductTrial.endDate)
      .format('MMMM Do YYYY');
    expect(screen.getByText(/Current trial ends:/)).toBeInTheDocument();
    expect(screen.getByText(`${expectedCurrentDate} UTC`)).toBeInTheDocument();
  });

  it('calculates new end date correctly', () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    // New end date should be current + 14 days (default)
    const expectedNewDate = moment
      .utc(activeProductTrial.endDate)
      .add(14, 'days')
      .format('MMMM Do YYYY');
    expect(screen.getByText(`${expectedNewDate} UTC`)).toBeInTheDocument();
  });

  it('updates new end date when days change', async () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    const input = screen.getByDisplayValue('14');
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    const expectedNewDate = moment
      .utc(activeProductTrial.endDate)
      .add(30, 'days')
      .format('MMMM Do YYYY');
    expect(screen.getByText(`${expectedNewDate} UTC`)).toBeInTheDocument();
  });

  it('disables confirm button for values less than 1', async () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    const input = screen.getByDisplayValue('14');
    await userEvent.clear(input);
    await userEvent.type(input, '0');

    expect(defaultProps.disableConfirmButton).toHaveBeenCalledWith(true);
  });

  it('disables confirm button for values greater than 180', async () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    const input = screen.getByDisplayValue('14');
    await userEvent.clear(input);
    await userEvent.type(input, '181');

    expect(defaultProps.disableConfirmButton).toHaveBeenCalledWith(true);
  });

  it('enables confirm button for valid values', async () => {
    render(<ExtendProductTrialAction {...defaultProps} />);

    const input = screen.getByDisplayValue('14');
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    expect(defaultProps.disableConfirmButton).toHaveBeenLastCalledWith(false);
  });

  it('calls onConfirm with correct data', () => {
    let confirmCallback: ((params: Record<string, unknown>) => void) | undefined;
    const setConfirmCallback = jest.fn(
      (cb: (params: Record<string, unknown>) => void) => {
        confirmCallback = cb;
      }
    );

    render(
      <ExtendProductTrialAction
        {...defaultProps}
        setConfirmCallback={setConfirmCallback}
      />
    );

    expect(setConfirmCallback).toHaveBeenCalled();

    // Trigger the confirm callback
    confirmCallback?.({notes: 'test notes'});

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      extendTrialReplays: true,
      extendTrialDays: 14,
      notes: 'test notes',
    });
  });

  it('formats API name correctly for multi-word categories', () => {
    let confirmCallback: ((params: Record<string, unknown>) => void) | undefined;
    const setConfirmCallback = jest.fn(
      (cb: (params: Record<string, unknown>) => void) => {
        confirmCallback = cb;
      }
    );

    render(
      <ExtendProductTrialAction
        {...defaultProps}
        apiName="profileDuration"
        trialName="Continuous Profiling"
        setConfirmCallback={setConfirmCallback}
      />
    );

    confirmCallback?.({});

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      extendTrialProfileDuration: true,
      extendTrialDays: 14,
    });
  });
});
