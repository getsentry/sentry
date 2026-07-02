import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import MigrateLegacySeerAction from 'admin/components/migrateLegacySeerAction';

describe('MigrateLegacySeerAction', () => {
  const organization = OrganizationFixture();
  // Default fixture has onDemandPeriodEnd: '2018-10-24', which moment formats as 'Oct 24, 2018'
  const subscription = SubscriptionFixture({organization});

  function openModal() {
    openAdminConfirmModal({
      showAuditFields: false,
      renderModalSpecificContent: deps => (
        <MigrateLegacySeerAction
          orgId={organization.slug}
          subscription={subscription}
          {...deps}
        />
      ),
    });
    renderGlobalModal();
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('renders timing options with Immediately selected by default', () => {
    openModal();

    expect(screen.getByRole('radio', {name: /Immediately/})).toBeChecked();
    expect(screen.getByRole('radio', {name: /At period end/})).not.toBeChecked();
  });

  it('renders Seer trial checkbox checked by default', () => {
    openModal();

    expect(
      screen.getByRole('checkbox', {name: /Add 14-day Seer seat trial/})
    ).toBeChecked();
  });

  it('shows the subscription period end date in timing options', () => {
    openModal();

    // Period end appears in the "At period end" label and the Immediately help text
    expect(screen.getByText(/At period end \(Oct 24, 2018\)/)).toBeInTheDocument();
  });

  it('shows "starting immediately" for the trial label when Immediately is selected', () => {
    openModal();

    expect(screen.getByText(/starting immediately/)).toBeInTheDocument();
  });

  it('updates trial label to show period end when switching to period-end timing', async () => {
    openModal();

    await userEvent.click(screen.getByRole('radio', {name: /At period end/}));

    expect(screen.getByText(/starting at the next billing period/)).toBeInTheDocument();
    expect(screen.queryByText(/starting immediately/)).not.toBeInTheDocument();
  });

  it('can switch to period-end timing', async () => {
    openModal();

    const periodEndRadio = screen.getByRole('radio', {name: /At period end/});
    await userEvent.click(periodEndRadio);

    expect(periodEndRadio).toBeChecked();
    expect(screen.getByRole('radio', {name: /Immediately/})).not.toBeChecked();
  });

  it('can uncheck the Seer trial', async () => {
    openModal();

    const trialCheckbox = screen.getByRole('checkbox', {
      name: /Add 14-day Seer seat trial/,
    });
    await userEvent.click(trialCheckbox);

    expect(trialCheckbox).not.toBeChecked();
  });

  it('posts with applyImmediately=true and addSeerTrial=true by default', async () => {
    const migrateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(migrateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/migrate-legacy-seer/`,
        expect.objectContaining({
          method: 'POST',
          data: {applyImmediately: true, addSeerTrial: true},
        })
      );
    });
  });

  it('posts with applyImmediately=false when period-end timing is selected', async () => {
    const migrateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('radio', {name: /At period end/}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(migrateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/migrate-legacy-seer/`,
        expect.objectContaining({
          data: {applyImmediately: false, addSeerTrial: true},
        })
      );
    });
  });

  it('posts with addSeerTrial=false when trial checkbox is unchecked', async () => {
    const migrateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(
      screen.getByRole('checkbox', {name: /Add 14-day Seer seat trial/})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(migrateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/migrate-legacy-seer/`,
        expect.objectContaining({
          data: {applyImmediately: true, addSeerTrial: false},
        })
      );
    });
  });

  it('shows success message after migration completes', async () => {
    const successMessage = jest.spyOn(
      require('sentry/actionCreators/indicator'),
      'addSuccessMessage'
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(successMessage).toHaveBeenCalledWith('Legacy Seer migration complete.');
    });
  });

  it('shows error detail from API response on failure', async () => {
    const errorMessage = jest.spyOn(
      require('sentry/actionCreators/indicator'),
      'addErrorMessage'
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'This organization does not have legacy Seer configured.'},
    });

    openModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(errorMessage).toHaveBeenCalledWith(
        'This organization does not have legacy Seer configured.'
      );
    });
  });

  it('shows loading message before the API call resolves', async () => {
    const loadingMessage = jest.spyOn(
      require('sentry/actionCreators/indicator'),
      'addLoadingMessage'
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/migrate-legacy-seer/`,
      method: 'POST',
      body: {},
    });

    openModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(loadingMessage).toHaveBeenCalledWith('Running legacy Seer migration\u2026');
  });
});
