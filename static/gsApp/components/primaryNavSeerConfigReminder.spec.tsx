import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {PrimaryNavSeerConfigReminder} from 'getsentry/components/primaryNavSeerConfigReminder';

function OnboardingCheckLoaded() {
  const organization = useOrganization();
  const {isSuccess} = useQuery(
    getSeerOnboardingCheckQueryOptions({organization, staleTime: 60_000})
  );
  return isSuccess ? <div>onboarding check loaded</div> : null;
}

function renderReminder(organization: Organization) {
  return render(
    <Fragment>
      <PrimaryNavSeerConfigReminder />
      <OnboardingCheckLoaded />
    </Fragment>,
    {organization}
  );
}

describe('PrimaryNavSeerConfigReminder', () => {
  function mockOnboardingCheck(organization: Organization, isAutofixEnabled: boolean) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled,
        isSeerConfigured: false,
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the reminder for a seat-based org', async () => {
    const organization = OrganizationFixture({features: ['seat-based-seer-enabled']});
    mockOnboardingCheck(organization, false);

    renderReminder(organization);

    await userEvent.click(await screen.findByRole('button', {name: 'Configure Seer'}));
    expect(await screen.findByText('Start using Autofix')).toBeInTheDocument();
  });

  it('shows the reminder for a token-billed org', async () => {
    const organization = OrganizationFixture({
      features: ['seer-token-based-billing-onboarding', 'token-billed-seer-enabled'],
    });
    mockOnboardingCheck(organization, false);

    renderReminder(organization);

    await userEvent.click(await screen.findByRole('button', {name: 'Configure Seer'}));
    expect(await screen.findByText('Start using Autofix')).toBeInTheDocument();
  });

  it.each([
    ['neither billing model', []],
    ['only the token billing onboarding flag', ['seer-token-based-billing-onboarding']],
    ['only the token-billed flag', ['token-billed-seer-enabled']],
  ])('hides the reminder for an org with %s', async (_, features) => {
    const organization = OrganizationFixture({features});
    mockOnboardingCheck(organization, false);

    renderReminder(organization);

    expect(await screen.findByText('onboarding check loaded')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Configure Seer'})
    ).not.toBeInTheDocument();
  });

  it('hides the reminder for a token-billed org with repos connected', async () => {
    const organization = OrganizationFixture({
      features: ['seer-token-based-billing-onboarding', 'token-billed-seer-enabled'],
    });
    mockOnboardingCheck(organization, true);

    renderReminder(organization);

    expect(await screen.findByText('onboarding check loaded')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Configure Seer'})
    ).not.toBeInTheDocument();
  });
});
