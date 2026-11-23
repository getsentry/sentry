import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import type {Organization} from 'sentry/types/organization';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';

import {GsBillingCommandPaletteActions} from 'getsentry/components/gsBillingCommandPaletteActions';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

mockElementSize();

function renderPalette(organization: Organization) {
  const closeModal = jest.fn();
  return render(
    <CommandPaletteProvider>
      <CommandPaletteSlot name="global">
        <GsBillingCommandPaletteActions />
      </CommandPaletteSlot>
      <div style={{display: 'none'}}>
        <CommandPaletteSlot.Outlet name="global">
          {p => <div {...p} />}
        </CommandPaletteSlot.Outlet>
      </div>
      <CommandPalette
        closeModal={closeModal}
        Body={ModalBody}
        Footer={ModalFooter}
        Header={makeClosableHeader(closeModal)}
        CloseButton={makeCloseButton(closeModal)}
      />
    </CommandPaletteProvider>,
    {organization}
  );
}

async function search(query: string) {
  const input = await screen.findByRole('searchbox', {name: 'Search commands'});
  await userEvent.type(input, query);
}

describe('GsBillingCommandPaletteActions', () => {
  it.each([
    'credit card',
    'update payment method',
    'billing details',
    'edit billing information',
  ])('goes to billing information when searching for %s', async query => {
    const organization = OrganizationFixture({access: ['org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );

    const {router} = renderPalette(organization);
    await search(query);
    await userEvent.click(
      await screen.findByRole('option', {name: /Billing Information/})
    );

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/settings/${organization.slug}/billing/details/`
      )
    );
  });

  it('hides billing information without billing access', async () => {
    const organization = OrganizationFixture({access: []});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: true})
      )
    );

    renderPalette(organization);
    await search('billing');

    expect(await screen.findByRole('option', {name: /Subscription/})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: /Billing Information/})
    ).not.toBeInTheDocument();
  });

  it.each<[string, Partial<Subscription>]>([
    ['partner-billed subscriptions', {isSelfServePartner: true}],
    ['enterprise trials', {plan: 'am3_t_ent'}],
    [
      'sales-led subscriptions without pay-as-you-go',
      {plan: 'am3_business_ent_auf', canSelfServe: false, supportsOnDemand: false},
    ],
  ])('hides billing information for %s', async (_, subscriptionProps) => {
    const organization = OrganizationFixture({access: ['org:billing']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, ...subscriptionProps})
      )
    );

    renderPalette(organization);
    await search('billing');

    expect(await screen.findByRole('option', {name: /Subscription/})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: /Billing Information/})
    ).not.toBeInTheDocument();
  });
});
