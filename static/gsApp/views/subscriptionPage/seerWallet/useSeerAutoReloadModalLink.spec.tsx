import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import type {Organization} from 'sentry/types/organization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {useSeerAutoReloadModalLink} from 'getsentry/views/subscriptionPage/seerWallet/useSeerAutoReloadModalLink';

function LinkedPage({organization}: {organization: Organization}) {
  useSeerAutoReloadModalLink(organization);
  return <GlobalModal />;
}

describe('useSeerAutoReloadModalLink', () => {
  function renderLink(organization: Organization, path: string) {
    // A member of an org that can't self-serve, so the modal loads nothing.
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: false})
      )
    );
    return render(<LinkedPage organization={organization} />, {
      organization,
      initialRouterConfig: {location: {pathname: path}},
    });
  }

  it('opens the auto-reload modal from a link to any page', async () => {
    const organization = OrganizationFixture({
      access: ['org:read'],
      features: ['token-billed-seer-enabled'],
    });

    const {router} = renderLink(
      organization,
      `/organizations/${organization.slug}/issues/?query=is%3Aunresolved#open-seer-auto-reload-modal:daily_cap_exceeded`
    );

    // The modal gets the reason from the link.
    expect(
      await screen.findByText(
        'Your organization hit its daily Seer usage limit. Only owners and billing members can manage auto-reload, so ask your admin to increase the limit.'
      )
    ).toBeInTheDocument();
    expect(router.location.pathname).toBe(`/organizations/${organization.slug}/issues/`);
    expect(router.location.query).toEqual({query: 'is:unresolved'});
    expect(router.location.hash).toBe('');
  });

  it('ignores the link in orgs without token-billed Seer', () => {
    const organization = OrganizationFixture({access: ['org:read'], features: []});

    const {router} = renderLink(
      organization,
      `/organizations/${organization.slug}/issues/#open-seer-auto-reload-modal`
    );

    expect(router.location.hash).toBe('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
