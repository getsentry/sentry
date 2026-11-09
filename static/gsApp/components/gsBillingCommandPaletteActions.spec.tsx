import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

mockElementSize();

function renderPalette(organization: Organization) {
  const closeModal = jest.fn();
  render(
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
  const input = await screen.findByRole('textbox', {name: 'Search commands'});
  await userEvent.type(input, query);
}

describe('GsBillingCommandPaletteActions', () => {
  it('finds billing information when searching for a credit card', async () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );

    renderPalette(organization);
    await search('credit card');

    expect(
      await screen.findByRole('option', {name: /Billing Information/})
    ).toBeInTheDocument();
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

  it('hides billing information for partner-billed subscriptions', async () => {
    const organization = OrganizationFixture({access: ['org:billing']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, isSelfServePartner: true})
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
