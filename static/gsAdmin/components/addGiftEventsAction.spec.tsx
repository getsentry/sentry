import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory, DataCategoryExact} from 'sentry/types/core';

import AddGiftEventsAction from 'admin/components/addGiftEventsAction';
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

  it('disallows gifts greater than max gift limit', async () => {
    const billedCategoryInfo = BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN];
    const maxValue =
      billedCategoryInfo.maxAdminGift / billedCategoryInfo.freeEventsMultiple;
    triggerGiftModal();
    renderGlobalModal();

    const input = getInput();

    await setNumEvents(`${maxValue + 5}`);
    expect(input).toHaveValue(maxValue.toString());
    expect(input).toHaveAccessibleDescription('Total: 1,000,000,000');
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
