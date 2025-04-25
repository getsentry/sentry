import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory, DataCategoryExact} from 'sentry/types/core';

import AddGiftEventsAction from 'admin/components/addGiftEventsAction';
import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import {BILLED_DATA_CATEGORY_INFO} from 'getsentry/constants';

describe('Gift', function () {
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg});

  describe('Errors', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.ERRORS}
            billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ERROR]}
            {...deps}
          />
        ),
      });
    };

    function getErrorInput() {
      return screen.getByRole('textbox', {
        name: 'How many errors in multiples of 1,000s? (50 is 50,000 errors)',
      });
    }

    async function setNumEvents(numEvents: string) {
      await userEvent.clear(getErrorInput());
      await userEvent.type(getErrorInput(), numEvents);
    }

    it('has valid event volume', async function () {
      const maxValue =
        BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ERROR].maxAdminGift / 1000;
      triggerGiftModal();

      renderGlobalModal();

      const errorInput = getErrorInput();

      await setNumEvents('1');
      expect(errorInput).toHaveValue('1');
      expect(errorInput).toHaveAccessibleDescription('Total: 1,000');

      await setNumEvents('-50');
      expect(errorInput).toHaveValue('50');
      expect(errorInput).toHaveAccessibleDescription('Total: 50,000');

      await setNumEvents(`${maxValue + 5}`);
      expect(errorInput).toHaveValue('10000');
      expect(errorInput).toHaveAccessibleDescription('Total: 10,000,000');

      await setNumEvents('10,');
      expect(errorInput).toHaveValue('10');
      expect(errorInput).toHaveAccessibleDescription('Total: 10,000');

      await setNumEvents('5.');
      expect(errorInput).toHaveValue('5');
      expect(errorInput).toHaveAccessibleDescription('Total: 5,000');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });

  describe('Attachments', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.ATTACHMENTS}
            billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT]}
            {...deps}
          />
        ),
      });
    };

    function getAttachmentsInput() {
      return screen.getByRole('textbox', {
        name: 'How many attachments in GB?',
      });
    }

    async function setNumAttachments(numAttachments: string) {
      await userEvent.clear(getAttachmentsInput());
      await userEvent.type(getAttachmentsInput(), numAttachments);
    }

    it('has valid event volume', async function () {
      const maxValue =
        BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT].maxAdminGift;
      triggerGiftModal();
      renderGlobalModal();

      const attachmentsInput = getAttachmentsInput();

      await setNumAttachments('1');
      expect(attachmentsInput).toHaveValue('1');
      expect(attachmentsInput).toHaveAccessibleDescription('Total: 1 GB');

      await setNumAttachments('-50');
      expect(attachmentsInput).toHaveValue('50');
      expect(attachmentsInput).toHaveAccessibleDescription('Total: 50 GB');

      await setNumAttachments(`${maxValue + 5}`);
      expect(attachmentsInput).toHaveValue('10000');
      expect(attachmentsInput).toHaveAccessibleDescription('Total: 10,000 GB');

      await setNumAttachments('10,');
      expect(attachmentsInput).toHaveValue('10');
      expect(attachmentsInput).toHaveAccessibleDescription('Total: 10 GB');

      await setNumAttachments('5.');
      expect(attachmentsInput).toHaveValue('5');
      expect(attachmentsInput).toHaveAccessibleDescription('Total: 5 GB');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });

  describe('Profile Duration', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.PROFILE_DURATION}
            billedCategoryInfo={
              BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION]
            }
            {...deps}
          />
        ),
      });
    };

    function getProfileDurationInput() {
      return screen.getByRole('textbox', {
        name: 'How many profile hours?',
      });
    }

    async function setProfileDuration(duration: string) {
      await userEvent.clear(getProfileDurationInput());
      await userEvent.type(getProfileDurationInput(), duration);
    }

    it('has valid profile duration input', async function () {
      const maxValue =
        BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION].maxAdminGift;
      triggerGiftModal();
      renderGlobalModal();

      const profileDurationInput = getProfileDurationInput();

      await setProfileDuration('1');
      expect(profileDurationInput).toHaveValue('1');
      expect(profileDurationInput).toHaveAccessibleDescription('Total: 1 hour');

      await setProfileDuration('-50');
      expect(profileDurationInput).toHaveValue('50');
      expect(profileDurationInput).toHaveAccessibleDescription('Total: 50 hours');

      await setProfileDuration(`${maxValue + 5}`);
      expect(profileDurationInput).toHaveValue('10000');
      expect(profileDurationInput).toHaveAccessibleDescription('Total: 10,000 hours');

      await setProfileDuration('10,');
      expect(profileDurationInput).toHaveValue('10');
      expect(profileDurationInput).toHaveAccessibleDescription('Total: 10 hours');

      await setProfileDuration('5.');
      expect(profileDurationInput).toHaveValue('5');
      expect(profileDurationInput).toHaveAccessibleDescription('Total: 5 hours');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });

  describe('Replays', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.REPLAYS}
            billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.REPLAY]}
            {...deps}
          />
        ),
      });
    };

    function getReplayInput() {
      return screen.getByRole('textbox', {
        name: 'How many replays? (50 is 50 replays)',
      });
    }

    async function setNumReplays(numReplays: string) {
      await userEvent.clear(getReplayInput());
      await userEvent.type(getReplayInput(), numReplays);
    }

    it('has valid replay input', async function () {
      const maxValue = BILLED_DATA_CATEGORY_INFO[DataCategoryExact.REPLAY].maxAdminGift;
      triggerGiftModal();

      renderGlobalModal();

      const replayInput = getReplayInput();

      await setNumReplays('1');
      expect(replayInput).toHaveValue('1');
      expect(replayInput).toHaveAccessibleDescription('Total: 1');

      await setNumReplays('-50');
      expect(replayInput).toHaveValue('50');
      expect(replayInput).toHaveAccessibleDescription('Total: 50');

      await setNumReplays(`${maxValue + 5}`);
      expect(replayInput).toHaveValue('1000000');
      expect(replayInput).toHaveAccessibleDescription('Total: 1,000,000');

      await setNumReplays('10,');
      expect(replayInput).toHaveValue('10');
      expect(replayInput).toHaveAccessibleDescription('Total: 10');

      await setNumReplays('5.');
      expect(replayInput).toHaveValue('5');
      expect(replayInput).toHaveAccessibleDescription('Total: 5');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });

  describe('Monitors', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.MONITOR_SEATS}
            billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT]}
            {...deps}
          />
        ),
      });
    };

    function getMonitorInput() {
      return screen.getByRole('textbox', {
        name: 'How many cron monitors? (50 is 50 cron monitors)',
      });
    }

    async function setNumMonitors(numMonitors: string) {
      await userEvent.clear(getMonitorInput());
      await userEvent.type(getMonitorInput(), numMonitors);
    }

    it('has valid monitor input', async function () {
      const maxValue =
        BILLED_DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT].maxAdminGift;
      triggerGiftModal();

      renderGlobalModal();

      const monitorInput = getMonitorInput();

      await setNumMonitors('1');
      expect(monitorInput).toHaveValue('1');
      expect(monitorInput).toHaveAccessibleDescription('Total: 1');

      await setNumMonitors('-50');
      expect(monitorInput).toHaveValue('50');
      expect(monitorInput).toHaveAccessibleDescription('Total: 50');

      await setNumMonitors(`${maxValue + 5}`);
      expect(monitorInput).toHaveValue('10000');
      expect(monitorInput).toHaveAccessibleDescription('Total: 10,000');

      await setNumMonitors('10,');
      expect(monitorInput).toHaveValue('10');
      expect(monitorInput).toHaveAccessibleDescription('Total: 10');

      await setNumMonitors('5.');
      expect(monitorInput).toHaveValue('5');
      expect(monitorInput).toHaveAccessibleDescription('Total: 5');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });

  describe('Uptime Monitors', function () {
    const triggerGiftModal = () => {
      openAdminConfirmModal({
        renderModalSpecificContent: deps => (
          <AddGiftEventsAction
            subscription={mockSub}
            dataCategory={DataCategory.UPTIME}
            billedCategoryInfo={BILLED_DATA_CATEGORY_INFO[DataCategoryExact.UPTIME]}
            {...deps}
          />
        ),
      });
    };

    function getMonitorInput() {
      return screen.getByRole('textbox', {
        name: 'How many uptime monitors? (50 is 50 uptime monitors)',
      });
    }

    async function setNumMonitors(numMonitors: string) {
      await userEvent.clear(getMonitorInput());
      await userEvent.type(getMonitorInput(), numMonitors);
    }

    it('has valid monitor input', async function () {
      const maxValue = BILLED_DATA_CATEGORY_INFO[DataCategoryExact.UPTIME].maxAdminGift;
      triggerGiftModal();

      renderGlobalModal();

      const monitorInput = getMonitorInput();

      await setNumMonitors('1');
      expect(monitorInput).toHaveValue('1');
      expect(monitorInput).toHaveAccessibleDescription('Total: 1');

      await setNumMonitors('-50');
      expect(monitorInput).toHaveValue('50');
      expect(monitorInput).toHaveAccessibleDescription('Total: 50');

      await setNumMonitors(`${maxValue + 5}`);
      expect(monitorInput).toHaveValue('10000');
      expect(monitorInput).toHaveAccessibleDescription('Total: 10,000');

      await setNumMonitors('10,');
      expect(monitorInput).toHaveValue('10');
      expect(monitorInput).toHaveAccessibleDescription('Total: 10');

      await setNumMonitors('5.');
      expect(monitorInput).toHaveValue('5');
      expect(monitorInput).toHaveAccessibleDescription('Total: 5');
    });

    it('disables confirm button when no number is entered', function () {
      triggerGiftModal();

      renderGlobalModal();
      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });
  });
});
