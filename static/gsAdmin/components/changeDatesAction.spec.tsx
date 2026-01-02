import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import triggerChangeDatesModal from 'admin/components/changeDatesAction';

describe('ChangeDatesAction', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    onDemandPeriodStart: '2024-01-01',
    onDemandPeriodEnd: '2024-02-01',
    contractPeriodStart: '2024-03-01',
    contractPeriodEnd: '2024-04-01',
  });

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

  async function updateDateField(label: string, value: string) {
    const input = await screen.findByLabelText(label);
    await userEvent.click(input);
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard(value);
  }

  it('submits updated contract and on-demand dates', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {},
    });

    triggerChangeDatesModal(modalProps);
    const {waitForModalToHide} = renderGlobalModal();

    await updateDateField('Contract Period End Date', '2024-05-15');
    await updateDateField('On-Demand Period End Date', '2024-02-10');

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            onDemandPeriodStart: '2024-01-01',
            onDemandPeriodEnd: '2024-02-10',
            contractPeriodStart: '2024-03-01',
            contractPeriodEnd: '2024-05-15',
          },
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
