import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CreditCardSetup} from './setup';

const organization = OrganizationFixture();

function SetupFlow() {
  const [saved, setSaved] = useState(false);

  return saved ? (
    <div>Payment method saved</div>
  ) : (
    <CreditCardSetup
      organization={organization}
      budgetTerm="pay-as-you-go"
      onSuccess={() => setSaved(true)}
    />
  );
}

it('saves a payment method without an invoice', async () => {
  const setupIntent = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/payments/setup/`,
    method: 'POST',
    body: {clientSecret: 'setup-secret'},
  });
  const updatePaymentMethod = MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/`,
    method: 'PUT',
    body: SubscriptionFixture({organization}),
  });

  render(<SetupFlow />);

  await userEvent.click(await screen.findByRole('button', {name: 'Save Changes'}));

  expect(await screen.findByText('Payment method saved')).toBeInTheDocument();
  expect(setupIntent).toHaveBeenCalledTimes(1);
  expect(updatePaymentMethod).toHaveBeenCalledWith(
    `/customers/${organization.slug}/`,
    expect.objectContaining({data: expect.objectContaining({paymentMethod: 'test-pm'})})
  );
});
