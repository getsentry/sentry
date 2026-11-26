import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {DataCategory, DataCategoryExact} from 'sentry/types/core';

import {AddGiftEventsAction} from 'admin/components/addGiftEventsAction';
import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import {BILLED_DATA_CATEGORY_INFO} from 'getsentry/constants';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';

describe('AddGiftEventsAction', () => {
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg, plan: 'am3_f'});
  let categoryOverride: DataCategory | undefined;
  let nameOverride: string | undefined;
  const triggerGiftModal = () => {
    const billedCategoryInfo = categoryOverride
      ? getCategoryInfoFromPlural(categoryOverride)
      : BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN];
    openAdminConfirmModal({
      renderModalSpecificContent: deps => (
        <AddGiftEventsAction
          subscription={mockSub}
          dataCategory={categoryOverride ?? DataCategory.SPANS}
          billedCategoryInfo={billedCategoryInfo}
          {...deps}
        />
      ),
    });
  };

  function getInput() {
    return screen.getByRole('textbox', {
      name:
        nameOverride ??
        'How many spans in multiples of 100,000s? (50 is 5,000,000 spans)',
    });
  }

  async function setNumEvents(numEvents: string) {
    await userEvent.clear(getInput());
    await userEvent.type(getInput(), numEvents);
  }

  beforeEach(() => {
    categoryOverride = undefined;
    nameOverride = undefined;
  });

  it('renders product of input and gifting multiple', async () => {
    triggerGiftModal();
    renderGlobalModal();

    const input = getInput();

    await setNumEvents('1');
    expect(input).toHaveValue('1');
    expect(input).toHaveAccessibleDescription('Total: 100,000');

    await setNumEvents('-5');
    expect(input).toHaveValue('5');
    expect(input).toHaveAccessibleDescription('Total: 500,000');

    await setNumEvents('10,');
    expect(input).toHaveValue('10');
    expect(input).toHaveAccessibleDescription('Total: 1,000,000');

    await setNumEvents('5.');
    expect(input).toHaveValue('5');
    expect(input).toHaveAccessibleDescription('Total: 500,000');
  });

  it('disables confirm button when no number is entered', () => {
    triggerGiftModal();
    renderGlobalModal();
    expect(screen.getByTestId('confirm-button')).toBeDisabled();
  });

  it('confirms the gifted total with the audit params', async () => {
    const onConfirm = jest.fn();
    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <AddGiftEventsAction
          subscription={mockSub}
          dataCategory={DataCategory.SPANS}
          billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN]}
          {...deps}
        />
      ),
    });
    renderGlobalModal();

    await setNumEvents('5');
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'gift');
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({addFreeSpans: 500_000, notes: 'gift'})
    );
  });

  it('keeps confirm disabled while the ticket URL is invalid', async () => {
    triggerGiftModal();
    renderGlobalModal();

    await setNumEvents('5');
    expect(screen.getByTestId('confirm-button')).toBeEnabled();

    await userEvent.type(screen.getByRole('textbox', {name: 'TicketURL'}), '1invalid');
    await userEvent.click(screen.getByRole('textbox', {name: 'Notes'}));
    expect(screen.getByTestId('confirm-button')).toBeDisabled();

    await setNumEvents('6');
    expect(screen.getByTestId('confirm-button')).toBeDisabled();
  });

  it('allows gifts of any size', async () => {
    triggerGiftModal();
    renderGlobalModal();

    const input = getInput();

    await setNumEvents('50000');
    expect(input).toHaveValue('50000');
    expect(input).toHaveAccessibleDescription('Total: 5,000,000,000');
  });

  it('renders label and help text with hours for continuous profiling categories', async () => {
    categoryOverride = DataCategory.PROFILE_DURATION;
    nameOverride = 'How many profile hours?';
    triggerGiftModal();
    renderGlobalModal();
    expect(screen.getByText('How many profile hours?')).toBeInTheDocument();

    const input = getInput();

    await setNumEvents('1');
    expect(input).toHaveValue('1');
    expect(input).toHaveAccessibleDescription('Total: 1 hour');
  });

  it('renders label and help text with GB for byte categories', async () => {
    categoryOverride = DataCategory.ATTACHMENTS;
    nameOverride = 'How many attachments in GB?';
    triggerGiftModal();
    renderGlobalModal();
    expect(screen.getByText('How many attachments in GB?')).toBeInTheDocument();

    const input = getInput();

    await setNumEvents('1');
    expect(input).toHaveValue('1');
    expect(input).toHaveAccessibleDescription('Total: 1 GB');
  });
});
