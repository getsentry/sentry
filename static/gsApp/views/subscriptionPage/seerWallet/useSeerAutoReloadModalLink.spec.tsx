import {useEffect, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modalActions from '@sentry/scraps/modal';
import {GlobalModal} from '@sentry/scraps/modal';

import type {Organization} from 'sentry/types/organization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {useSeerAutoReloadModalLink} from 'getsentry/views/subscriptionPage/seerWallet/useSeerAutoReloadModalLink';

function LinkedPage({organization}: {organization: Organization}) {
  useSeerAutoReloadModalLink(organization);
  return <GlobalModal />;
}

/**
 * Gets a new organization object right after the link opens the modal, before
 * the navigation that clears the hash lands, as when the organization reloads.
 */
function LinkedPageWithOrganizationUpdate({organization}: {organization: Organization}) {
  const [current, setCurrent] = useState(organization);
  useSeerAutoReloadModalLink(current);
  // Runs after the hook's effect, in the same commit, so the update renders
  // before the navigation does.
  // oxlint-disable-next-line react/set-state-in-effect, react-you-might-not-need-an-effect/no-derived-state
  useEffect(() => setCurrent(previous => ({...previous})), []);
  return null;
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
    // The credit check's answer would win over the link's reason, so it fails here.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/credit-check/`,
      statusCode: 500,
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

  it('opens the modal once when the organization updates before the hash clears', async () => {
    const openModal = jest.spyOn(modalActions, 'openModal').mockImplementation(() => {});
    const organization = OrganizationFixture({
      access: ['org:read'],
      features: ['token-billed-seer-enabled'],
    });

    const {router} = render(
      <LinkedPageWithOrganizationUpdate organization={organization} />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/#open-seer-auto-reload-modal`,
          },
        },
      }
    );

    await waitFor(() => expect(router.location.hash).toBe(''));
    expect(openModal).toHaveBeenCalledTimes(1);
    openModal.mockRestore();
  });

  it('opens the modal again when the link is followed again', async () => {
    const openModal = jest.spyOn(modalActions, 'openModal').mockImplementation(() => {});
    const organization = OrganizationFixture({
      access: ['org:read'],
      features: ['token-billed-seer-enabled'],
    });
    const path = `/settings/${organization.slug}/billing/overview/`;

    const {router} = renderLink(organization, `${path}#open-seer-auto-reload-modal`);
    await waitFor(() => expect(router.location.hash).toBe(''));

    // The credit meter links to the same page.
    act(() => router.navigate(`${path}#open-seer-auto-reload-modal`));

    await waitFor(() => expect(openModal).toHaveBeenCalledTimes(2));
    openModal.mockRestore();
  });
});
