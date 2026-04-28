import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

describe('SeerSettingsPageWrapper', () => {
  it('renders children for legacy cohorts', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
    });

    render(
      <SeerSettingsPageWrapper>
        <div>wrapped content</div>
      </SeerSettingsPageWrapper>,
      {organization}
    );

    expect(screen.getByText('wrapped content')).toBeInTheDocument();
  });

  it('redirects new non-seat-based cohorts to trial', async () => {
    const organization = OrganizationFixture({
      features: ['seer-user-billing-launch'],
    });

    const {router} = render(
      <SeerSettingsPageWrapper>
        <div>wrapped content</div>
      </SeerSettingsPageWrapper>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/settings/${organization.slug}/seer/repos/`,
          },
        },
      }
    );

    await waitFor(() => {
      expect(router.location.pathname).toBe(`/settings/${organization.slug}/seer/trial/`);
    });
  });

  it('shows no access for non-seer cohorts', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    render(
      <SeerSettingsPageWrapper>
        <div>wrapped content</div>
      </SeerSettingsPageWrapper>,
      {organization}
    );

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });
});
