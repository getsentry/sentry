import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {Guide} from 'sentry/components/assistant/types';
import {ConfigStore} from 'sentry/stores/configStore';
import type {GuideStoreState} from 'sentry/stores/guideStore';

import {openTrialEndingModal} from 'getsentry/actionCreators/modal';
import GSBanner from 'getsentry/components/gsBanner';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

jest.mock('getsentry/actionCreators/modal');
const mockGuideStore = {state: {} as GuideStoreState};
jest.mock('sentry/stores/guideStore', () => ({
  get GuideStore() {
    return mockGuideStore;
  },
}));

function setUpTests() {
  jest.clearAllMocks();
  delete window.pendo;

  MockApiClient.clearMockResponses();
  MockApiClient.addMockResponse({
    method: 'POST',
    url: '/_experiment/log_exposure/',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/teams/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/customers/org-slug/',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/',
    body: {},
  });

  [
    'another-slug-1',
    'another-slug-2',
    'another-slug-3',
    'another-slug-4',
    'org-slug',
    'promotion-platform',
    'forced-trial',
    'soft-cap',
    'trial-ending',
    'partner-plan-ending',
    'suspended',
    'exceeded',
    'past-due',
    'past-due-2',
    'past-due-3',
    'past-due-4',
  ].forEach(slug => {
    SubscriptionStore.set(slug, {});
    MockApiClient.addMockResponse({
      url: `/organizations/${slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${slug}/prompts-activity/`,
      body: {},
    });
  });
}

describe('GSBanner', () => {
  beforeEach(() => {
    setUpTests();
  });

  it('renders empty', async () => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(organization.slug, {});

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    // wait for requests to finish
    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('renders suspension modal', async () => {
    const organization = OrganizationFixture({slug: 'suspended'});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, isSuspended: true})
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Your account has been suspended with the following reason:')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Until this situation is resolved you will not be able to send events to Sentry. Please contact support if you have any questions or need assistance.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });

  it('opens the trialEndingModal within 3 days of ending', async () => {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'trial-ending',
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        isTrial: true,
        hasDismissedTrialEndingNotice: false,
        plan: 'am1_t',
        trialEnd: now.add(2, 'day').toISOString(),
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openTrialEndingModal).toHaveBeenCalled());
  });

  it('does not display trial ending modal more than 3 days', async () => {
    const now = moment();
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        hasDismissedTrialEndingNotice: false,
        plan: 'am1_t',
        trialEnd: now.add(5, 'day').toISOString(),
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(openTrialEndingModal).not.toHaveBeenCalled();
  });

  it('does not display trial ending modal to free plan', async () => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        hasDismissedTrialEndingNotice: false,
        plan: 'am1_f',
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(openTrialEndingModal).not.toHaveBeenCalled();
  });

  it('does not display trial ending modal to plan trial', async () => {
    const now = moment();
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        hasDismissedTrialEndingNotice: false,
        plan: 'am1_team',
        trialEnd: now.add(2, 'day').toISOString(),
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(openTrialEndingModal).not.toHaveBeenCalled();
  });

  it('does not display trial ending modal to enterprise trial', async () => {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'trial-ending',
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        isTrial: true,
        hasDismissedTrialEndingNotice: false,
        plan: 'am1_business',
        trialEnd: now.add(2, 'day').toISOString(),
        isEnterpriseTrial: true,
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(openTrialEndingModal).not.toHaveBeenCalled();
  });

  it('shows disabled member header', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        membersDeactivatedFromLimit: 2,
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/2 members have been deactivated/i))
    ).toBeInTheDocument();
  });

  it('loads pendo', async () => {
    mockGuideStore.state.currentGuide = null;
    const organization = OrganizationFixture({
      slug: 'forced-trial',
      orgRole: 'admin',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business_auf',
      onDemandMaxSpend: 1000,
      totalMembers: 26,
    });
    subscription.categories.errors!.reserved = 5_000_000;
    subscription.categories.transactions!.reserved = 10_000_001;
    subscription.planDetails.totalPrice = 100_000 * 12;
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
      body: {},
    });

    const now = moment();
    const promotionData = {
      availablePromotions: [
        {
          endDate: null,
          name: 'Lorem Ipsum',
          slug: 'lorem-ipsum',
          startDate: now.add(-14, 'day'),
          timeLimit: 'null',
          autoOptIn: true,
        },
      ],
    };
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      body: promotionData,
    });

    window.pendo = {
      initialize: jest.fn(),
    };

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/pendo-details/`,
      body: {
        userDetails: {
          fieldA: 'valueA',
        },
        organizationDetails: {
          fieldB: 'valueB',
        },
      },
    });
    const user = ConfigStore.get('user');

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(window.pendo.initialize).toHaveBeenCalledWith({
        visitor: {
          id: `${organization.id}.${user.id}`,
          userId: user.id,
          role: 'admin',
          isDarkMode: false,
          fieldA: 'valueA',
        },
        account: expect.objectContaining({
          id: organization.id,
          hasOnDemandSpend: true,
          reservedErrors: 'indigo',
          reservedTransactions: 'violet',
          totalMembers: 'blue',
          arr: 'yellow',
          fieldB: 'valueB',
          plan: 'am1_business_auf',
        }),
        guides: {
          delay: false,
        },
      });
    });

    delete window.pendo;
  });

  it('delays pendo guides if other guides are active', async () => {
    mockGuideStore.state.currentGuide = {} as Guide;
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
      })
    );

    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
      body: {},
    });

    window.pendo = {
      initialize: jest.fn(),
    };

    const now = moment();
    const promotionData = {
      availablePromotions: [
        {
          endDate: null,
          name: 'Lorem Ipsum',
          slug: 'lorem-ipsum',
          startDate: now.add(-14, 'day'),
          timeLimit: 'null',
          autoOptIn: true,
        },
      ],
    };
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      body: promotionData,
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/pendo-details/`,
      body: {
        userDetails: {
          fieldA: 'valueA',
        },
        organizationDetails: {
          fieldB: 'valueB',
        },
      },
    });

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(window.pendo.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          guides: {
            delay: true,
          },
        })
      );
    });
  });

  it('activates the first available promotion', async () => {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'promotion-platform',
    });

    const promotionData = {
      availablePromotions: [
        {
          endDate: null,
          name: 'Lorem Ipsum',
          slug: 'lorem-ipsum',
          startDate: now.add(-14, 'day'),
          timeLimit: 'null',
          autoOptIn: true,
        },
      ],
    };
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      body: promotionData,
    });

    const activatePromoEndpoint = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
      body: {},
    });

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'am1_team',
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(activatePromoEndpoint).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it("doesn't activate non auto-opt-in promos", async () => {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'promotion-platform',
    });

    const promotionData = {
      availablePromotions: [
        {
          endDate: null,
          name: 'Lorem Ipsum',
          slug: 'lorem-ipsum',
          startDate: now.add(-14, 'day'),
          timeLimit: 'null',
          autoOptIn: false,
        },
      ],
    };
    MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      body: promotionData,
    });

    const activatePromoEndpoint = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
      body: {},
    });

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'am1_team',
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(activatePromoEndpoint).not.toHaveBeenCalledWith(
        `/organizations/${organization.slug}/promotions/lorem-ipsum/claim/`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('shows correct past due modal and banner for billing admins', async () => {
    const organization = OrganizationFixture({
      slug: 'past-due',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      isPastDue: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/past-due/billing/details/',
          query: {},
        },
        route: '/settings/past-due/billing/details/',
      },
    });
    // Modal does the navigation
    const {router} = renderGlobalModal();

    expect(await screen.findByTestId('banner-alert-past-due')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: /update payment information/i})
    ).toHaveAttribute(
      'href',
      '/settings/past-due/billing/details/?referrer=banner-billing-failure'
    );
    expect(await screen.findByTestId('modal-past-due')).toBeInTheDocument();

    expect(screen.getByTestId('modal-continue-button')).toBeInTheDocument();
    expect(
      screen.getByText(
        'There was an issue with your payment. Update your payment information to ensure uninterrupted access to Sentry.'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('modal-continue-button'));
    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/settings/past-due/billing/details/',
          query: {
            referrer: 'banner-billing-failure',
          },
        })
      );
    });
  });

  it('shows past due modal and banner for non-billing users', async () => {
    const organization = OrganizationFixture({
      slug: 'past-due-4',
      access: ['org:read'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      isPastDue: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByTestId('banner-alert-past-due')).toBeInTheDocument();
    expect(await screen.findByTestId('modal-past-due')).toBeInTheDocument();

    expect(screen.getByTestId('modal-continue-button')).toBeInTheDocument();
  });

  it('does not show past due modal for users without access', async () => {
    const organization = OrganizationFixture({
      slug: 'past-due-4',
      access: [],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      isPastDue: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    await act(tick);
    expect(screen.queryByTestId('modal-past-due')).not.toBeInTheDocument();

    expect(screen.queryByTestId('modal-continue-button')).not.toBeInTheDocument();
  });

  it('does not show past due modal for enterprise orgs', async () => {
    const organization = OrganizationFixture({
      slug: 'past-due-3',
      access: ['org:billing'],
    });
    const subscription = InvoicedSubscriptionFixture({
      organization,
      plan: 'am2_business_ent',
      isPastDue: true,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    await act(tick);
    expect(screen.queryByTestId('banner-alert-past-due')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /update payment information/i})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /update billing details/i})
    ).not.toBeInTheDocument();
  });
});
