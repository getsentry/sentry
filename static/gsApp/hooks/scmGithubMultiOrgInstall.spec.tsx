import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScmGithubMultiOrgInstall} from 'getsentry/hooks/scmGithubMultiOrgInstall';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

function makeInstallations(
  overrides?: Array<Partial<Parameters<typeof makeInstallation>[0]>>
) {
  const defaults = [
    {installationId: '100', githubAccount: 'my-org', count: 0},
    {installationId: '200', githubAccount: 'other-org', count: 2},
  ];
  return (overrides ?? defaults).map(makeInstallation);
}

function makeInstallation(
  partial: Partial<{
    avatarUrl: string;
    count: number;
    githubAccount: string;
    installationId: string;
  }> = {}
) {
  return {
    installationId: '100',
    githubAccount: 'my-org',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    count: 0,
    ...partial,
  };
}

describe('ScmGithubMultiOrgInstall', () => {
  const onSelectInstallation = jest.fn();
  const onNewInstall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  function renderComponent({
    hasFeature = false,
    installations = makeInstallations(),
    withSubscription = true,
  }: {
    hasFeature?: boolean;
    installations?: ReturnType<typeof makeInstallations>;
    withSubscription?: boolean;
  } = {}) {
    const organization = OrganizationFixture({
      features: hasFeature ? ['integrations-scm-multi-org'] : [],
    });

    if (withSubscription) {
      const subscription = SubscriptionFixture({organization});
      SubscriptionStore.set(organization.slug, subscription);

      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/`,
        query: {tier: 'am2'},
        body: BillingConfigFixture(PlanTier.AM2),
      });
    }

    return render(
      <ScmGithubMultiOrgInstall
        installations={installations}
        onSelectInstallation={onSelectInstallation}
        onNewInstall={onNewInstall}
      />,
      {organization}
    );
  }

  it('renders dropdown without alert when org has scm-multi-org feature', () => {
    renderComponent({hasFeature: true});

    expect(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/already connected to other Sentry organizations/)
    ).not.toBeInTheDocument();
  });

  it('renders dropdown without alert when no installations have count > 0', () => {
    renderComponent({
      hasFeature: false,
      installations: [
        makeInstallation({installationId: '100', githubAccount: 'my-org', count: 0}),
        makeInstallation({
          installationId: '200',
          githubAccount: 'other-org',
          count: 0,
        }),
      ],
    });

    expect(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/already connected to other Sentry organizations/)
    ).not.toBeInTheDocument();
  });

  it('shows upgrade alert when org lacks feature and has multi-org installations', () => {
    renderComponent({hasFeature: false});

    expect(
      screen.getByText(/already connected to other Sentry organizations/)
    ).toBeInTheDocument();
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('upgrade link points to billing page in new tab', () => {
    renderComponent({hasFeature: false});

    const link = screen.getByText('Upgrade').closest('a');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/billing/overview/?referrer=upgrade-github-multi-org')
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('calls onSelectInstallation when clicking a non-multi-org item', async () => {
    renderComponent({hasFeature: true});

    await userEvent.click(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    );
    await userEvent.click(await screen.findByText('github.com/my-org'));

    expect(onSelectInstallation).toHaveBeenCalledWith('100');
  });

  it('calls onNewInstall when clicking new install option', async () => {
    renderComponent({hasFeature: true});

    await userEvent.click(
      screen.getByRole('button', {name: 'Select GitHub organization'})
    );
    await userEvent.click(
      await screen.findByText('Install on a new GitHub organization')
    );

    expect(onNewInstall).toHaveBeenCalled();
  });
});
