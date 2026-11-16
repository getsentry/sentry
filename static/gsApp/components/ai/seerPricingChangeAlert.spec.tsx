import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerPricingChangeAlert} from 'getsentry/components/ai/seerPricingChangeAlert';

describe('SeerPricingChangeAlert', () => {
  it('does not announce Seer credits to an org that already uses them', () => {
    render(<SeerPricingChangeAlert />, {
      organization: OrganizationFixture({features: ['token-billed-seer-enabled']}),
    });

    expect(
      screen.queryByText(/How we charge for Seer is changing/)
    ).not.toBeInTheDocument();
  });
});
