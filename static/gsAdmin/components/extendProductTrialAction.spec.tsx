import moment from 'moment-timezone';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from '@sentry/scraps/modal';

import {DataCategory} from 'sentry/types/core';

import {ExtendProductTrialAction} from 'admin/components/extendProductTrialAction';

describe('ExtendProductTrialAction', () => {
  const activeProductTrial = {
    category: DataCategory.REPLAYS,
    isStarted: true,
    reasonCode: 1001,
    startDate: moment().utc().subtract(10, 'days').format(),
    endDate: moment().utc().add(4, 'days').format(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default 14 days', () => {
    openModal(deps => (
      <ExtendProductTrialAction
        {...deps}
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        onConfirm={jest.fn()}
      />
    ));
    renderGlobalModal();

    expect(screen.getByText(/Extend the/)).toBeInTheDocument();
    expect(screen.getByText('Replays')).toBeInTheDocument();
    expect(screen.getByDisplayValue('14')).toBeInTheDocument();
  });

  it('displays current trial end date in UTC', () => {
    openModal(deps => (
      <ExtendProductTrialAction
        {...deps}
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        onConfirm={jest.fn()}
      />
    ));
    renderGlobalModal();

    const expectedCurrentDate = moment
      .utc(activeProductTrial.endDate)
      .format('MMMM Do YYYY');
    expect(screen.getByText(/Current trial ends:/)).toBeInTheDocument();
    expect(screen.getByText(`${expectedCurrentDate} UTC`)).toBeInTheDocument();
  });

  it('calculates new end date correctly', () => {
    openModal(deps => (
      <ExtendProductTrialAction
        {...deps}
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        onConfirm={jest.fn()}
      />
    ));
    renderGlobalModal();

    // New end date should be current + 14 days (default)
    const expectedNewDate = moment
      .utc(activeProductTrial.endDate)
      .add(14, 'days')
      .format('MMMM Do YYYY');
    expect(
      screen.getByText(`New trial end date: ${expectedNewDate} UTC`)
    ).toBeInTheDocument();
  });

  it('updates new end date when days change', async () => {
    openModal(deps => (
      <ExtendProductTrialAction
        {...deps}
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        onConfirm={jest.fn()}
      />
    ));
    renderGlobalModal();

    const input = screen.getByDisplayValue('14');
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    const expectedNewDate = moment
      .utc(activeProductTrial.endDate)
      .add(30, 'days')
      .format('MMMM Do YYYY');
    expect(
      screen.getByText(`New trial end date: ${expectedNewDate} UTC`)
    ).toBeInTheDocument();
  });

  it.each([
    ['0', 'Extend by at least 1 day'],
    ['181', 'Extend by at most 180 days'],
  ])('shows an error on confirm for %s days', async (days, error) => {
    const onConfirm = jest.fn();
    openModal(deps => (
      <ExtendProductTrialAction
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        {...deps}
        onConfirm={onConfirm}
      />
    ));
    renderGlobalModal();

    const input = screen.getByRole('spinbutton', {name: 'Number of Days to Extend'});
    await userEvent.clear(input);
    await userEvent.type(input, days);

    const confirmButton = screen.getByRole('button', {name: 'Extend Trial'});
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with correct data', async () => {
    const onConfirm = jest.fn();
    openModal(deps => (
      <ExtendProductTrialAction
        activeProductTrial={activeProductTrial}
        apiName="replays"
        trialName="Replays"
        {...deps}
        onConfirm={onConfirm}
      />
    ));
    renderGlobalModal();

    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'test notes');
    await userEvent.click(screen.getByRole('button', {name: 'Extend Trial'}));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        extendTrialReplays: true,
        extendTrialDays: 14,
        notes: 'test notes',
      })
    );
  });

  it('formats API name correctly for multi-word categories', async () => {
    const onConfirm = jest.fn();
    openModal(deps => (
      <ExtendProductTrialAction
        activeProductTrial={activeProductTrial}
        apiName="profileDuration"
        trialName="Continuous Profiling"
        {...deps}
        onConfirm={onConfirm}
      />
    ));
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Extend Trial'}));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        extendTrialProfileDuration: true,
        extendTrialDays: 14,
      })
    );
  });
});
