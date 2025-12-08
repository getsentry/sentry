import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import triggerEndPeriodEarlyModal from 'admin/components/nextBillingPeriodAction';

describe('NextBillingPeriodAction', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const onSuccess = jest.fn();

  const modalProps = {
    orgId: organization.slug,
    onSuccess,
    subscription,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
    jest.clearAllMocks();
  });

  it('ends the current period immediately', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {},
    });

    triggerEndPeriodEarlyModal(modalProps);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {endPeriodEarly: true},
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
