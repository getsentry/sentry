import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
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

import ConfigStore from 'sentry/stores/configStore';
import ModalStore from 'sentry/stores/modalStore';
import {DataCategory} from 'sentry/types/core';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {
  openForcedTrialModal,
  openPartnerPlanEndingModal,
  openTrialEndingModal,
} from 'getsentry/actionCreators/modal';
import GSBanner from 'getsentry/components/gsBanner';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

jest.mock('getsentry/actionCreators/modal');
const guideMock = jest.requireMock('sentry/stores/guideStore');
jest.mock('sentry/stores/guideStore', () => ({
  state: {},
}));

function setUpTests() {
  ModalStore.reset();
  jest.clearAllMocks();
  delete window.pendo;

  MockApiClient.clearMockResponses();
  MockApiClient.addMockResponse({
    method: 'POST',
    url: '/_experiment/log_exposure/',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/projects/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/teams/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/subscriptions/org-slug/`,
    body: {},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/`,
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
    'grace-period',
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

describe('GSBanner', function () {
  beforeEach(() => {
    setUpTests();
  });

  it('renders empty', async function () {
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
  it('renders suspension modal', async function () {
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

  it('renders usage exceeded modal', async function () {
    const organization = OrganizationFixture({slug: 'exceeded'});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, usageExceeded: true})
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByTestId('modal-usage-exceeded')).toBeInTheDocument();
  });

  it('renders grace period modal with billing access', async function () {
    const organization = OrganizationFixture({
      slug: 'grace-period',
      access: ['org:billing'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, isGracePeriod: true})
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByTestId('modal-grace-period')).toBeInTheDocument();
  });

  it('opens the trialEndingModal within 3 days of ending', async function () {
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

  it('does not display trial ending modal more than 3 days', async function () {
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

  it('does not display trial ending modal to free plan', async function () {
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

  it('does not display trial ending modal to plan trial', async function () {
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

  it('does not display trial ending modal to enterprise trial', async function () {
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

  it('opens the partnerPlanEndingModal within 30 days of ending', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(30, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('opens the partnerPlanEndingModal within 7 days of ending', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(7, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('opens the partnerPlanEndingModal with 2 days left', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(2, 'days').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('opens the partnerPlanEndingModal on day that plan ends', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('does not open the partnerPlanEndingModal without feature flag', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(7, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).not.toHaveBeenCalled());
  });

  it('does not open the partnerPlanEndingModal with pending upgrade', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(7, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
        pendingChanges: PendingChangesFixture({
          plan: 'am3_business',
          planDetails: PlanFixture({
            name: 'Business',
            price: 100,
          }),
        }),
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).not.toHaveBeenCalled());
  });

  it('opens the partnerPlanEndingModal with pending downgrade', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(7, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
        pendingChanges: PendingChangesFixture({
          plan: 'am3_f',
          planDetails: PlanFixture({
            name: 'Developer',
            price: 0,
          }),
        }),
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('does not open the partnerPlanEndingModal with more than 30 days before ending', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(31, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).not.toHaveBeenCalled());
  });

  it('does not open the partnerPlanEndingModal if dismissed', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        data: {
          dismissed_ts: moment().subtract(2, 'days').unix(),
        },
      },
    });

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(20, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).not.toHaveBeenCalled());
  });

  it('opens partnerPlanEndingModal if dismissed in different time period', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        data: {
          dismissed_ts: moment().subtract(20, 'days').unix(),
        },
      },
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(1, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('opens partnerPlanEndingModal if dismissed with 2 days left on day plan ends', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        data: {
          dismissed_ts: moment().subtract(2, 'days').unix(),
        },
      },
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).toHaveBeenCalled());
  });

  it('does not open partnerPlanEndingModal if dismissed with two days left and logs in with one day left', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'partner-plan-ending',
      features: ['partner-billing-migration'],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        data: {
          dismissed_ts: moment().subtract(1, 'days').unix(),
        },
      },
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        contractPeriodEnd: now.add(1, 'day').toISOString(),
        isTrial: true,
        plan: 'am2_sponsored_team_auf',
        partner: {
          externalId: '123',
          name: 'FOO',
          partnership: {
            id: 'FOO',
            displayName: 'FOO',
            supportNote: '',
          },
          isActive: true,
        },
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openPartnerPlanEndingModal).not.toHaveBeenCalled());
  });

  it('shows disabled member header', async function () {
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

  it('loads pendo', async function () {
    guideMock.state.currentGuide = false;
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

  it('delays pendo guides if other guides are active', async function () {
    guideMock.state.currentGuide = true;
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

  it('automatically starts forced trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      organization,
      totalLicenses: 1,
      usedLicenses: 2,
    });

    SubscriptionStore.set(organization.slug, subscription);

    const mockForceTrial = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/over-member-limit-trial/`,
      body: {},
    });

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(mockForceTrial).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/over-member-limit-trial/`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(openForcedTrialModal).toHaveBeenCalled();
  });

  it('automatically starts forced trial for restricted integration', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        plan: 'am1_f',
        organization,
        totalLicenses: 1,
        usedLicenses: 1,
        hasRestrictedIntegration: true,
      })
    );

    const mockForceTrial = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/restricted-integration-trial/`,
      body: {},
    });

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => {
      expect(mockForceTrial).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/restricted-integration-trial/`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
    expect(openForcedTrialModal).toHaveBeenCalled();
  });

  it('opens the forced trial modal', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'forced-trial',
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        hasDismissedForcedTrialNotice: false,
        plan: 'am1_t',
        trialEnd: now.add(14, 'day').toISOString(),
        isForcedTrial: true,
        isTrial: true,
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await waitFor(() => expect(openForcedTrialModal).toHaveBeenCalled());
  });

  it('does not open forced trial modal if dismissed', async function () {
    const now = moment();
    const organization = OrganizationFixture({
      slug: 'forced-trial',
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        hasDismissedForcedTrialNotice: true,
        plan: 'am1_t',
        trialEnd: now.add(14, 'day').toISOString(),
        isForcedTrial: true,
        isTrial: true,
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(openForcedTrialModal).not.toHaveBeenCalled();
  });

  it('activates the first available promotion', async function () {
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

  it("doesn't activate non auto-opt-in promos", async function () {
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

  it('shows correct past due modal and banner for billing admins', async function () {
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
    // @ts-expect-error renderGlobalModal not currently returning correct types
    const {router} = renderGlobalModal();

    expect(await screen.findByTestId('banner-alert-past-due')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: /update payment information/i})
    ).toHaveAttribute(
      'href',
      `/settings/past-due/billing/details/?referrer=banner-billing-failure`
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
          pathname: `/settings/past-due/billing/details/`,
          query: {
            referrer: 'banner-billing-failure',
          },
        })
      );
    });
  });

  it('shows past due modal and banner for non-billing users', async function () {
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

  it('does not show past due modal for users without access', async function () {
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

  it('does not show past due modal for enterprise orgs', async function () {
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

describe('GSBanner Overage Alerts', function () {
  beforeEach(() => {
    setUpTests();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows overage notification banner and request more events btn for members', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: false}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId('overage-banner-transaction-attachment')
    ).toBeInTheDocument();

    expect(screen.getByText('performance unit')).toBeInTheDocument();
    expect(screen.queryByText('transaction')).not.toBeInTheDocument();

    expect(screen.getByTestId('btn-request_add_events')).toBeInTheDocument();
  });

  it('does not show overage notification banner if is not self serve', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_t',
      categories: {attachments: MetricHistoryFixture({usageExceeded: true})},
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show overage notification banner if active product trial', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      categories: {replays: MetricHistoryFixture({usageExceeded: true})},
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.REPLAYS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(20, 'days').format(),
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows overage notification banner even if other category is on active trial', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      categories: {
        attachments: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.REPLAYS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(20, 'days').format(),
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(await screen.findByTestId('overage-banner-attachment')).toBeInTheDocument();
    expect(screen.queryByTestId('overage-banner-replay')).not.toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows start trial btn for billing admins if can trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId('overage-banner-transaction-attachment')
    ).toBeInTheDocument();

    expect(screen.getByTestId('btn-start_trial')).toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows upgrade plan btn for free plans for admins', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId('overage-banner-error-attachment')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: /upgrade plan/i})).toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows add quota btn for paid plans for admins', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId(
        'overage-banner-error-transaction-attachment-replay-monitorSeat'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: /setup on-demand/i})).toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows add quota button for paid plans without active product trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        spans: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: false}),
        monitorSeats: MetricHistoryFixture({usageExceeded: false}),
        profileDuration: MetricHistoryFixture({usageExceeded: false}),
        profileDurationUI: MetricHistoryFixture({usageExceeded: false}),
      },
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.SPANS,
          reasonCode: 1001,
          isStarted: false,
          lengthDays: undefined,
          startDate: undefined,
          endDate: undefined,
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByRole('button', {name: /setup pay-as-you-go/i})
    ).toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('does not show add quota button for paid plans with active product trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        spans: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: false}),
        monitorSeats: MetricHistoryFixture({usageExceeded: false}),
        profileDuration: MetricHistoryFixture({usageExceeded: false}),
        profileDurationUI: MetricHistoryFixture({usageExceeded: false}),
      },
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.SPANS,
          reasonCode: 1001,
          isStarted: true,
          lengthDays: 20,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(10, 'days').format(),
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });
    await act(tick);
    expect(
      screen.queryByRole('button', {name: /setup pay-as-you-go/i})
    ).not.toBeInTheDocument();
  });

  it('closes the banner when dismissed', async function () {
    const organization = OrganizationFixture();

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_t',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
        spans: MetricHistoryFixture({usageExceeded: true}),
        profileDuration: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    const snoozeEndpoint = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId(
        'overage-banner-error-transaction-attachment-replay-span-monitorSeat-profileDuration'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('btn-overage-notification-snooze')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('btn-overage-notification-snooze'));

    for (const feature of [
      'errors_overage_alert',
      'transactions_overage_alert',
      'replays_overage_alert',
      'attachments_overage_alert',
      'spans_overage_alert',
      'profile_duration_overage_alert',
    ]) {
      expect(snoozeEndpoint).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/prompts-activity/`,
        expect.objectContaining({
          data: {
            feature,
            organization_id: organization.id,
            status: 'snoozed',
          },
        })
      );
    }

    expect(screen.queryByTestId(/overage-banner/)).not.toBeInTheDocument();
  });

  it('does not show banner when dismissed', async function () {
    const organization = OrganizationFixture();
    const snoozeTime = new Date('2020-02-02');
    snoozeTime.setHours(23, 59, 59);
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        features: {
          transactions_overage_alert: {
            snoozed_ts: snoozeTime.getTime() / 1000,
          },
          replays_overage_alert: {
            snoozed_ts: snoozeTime.getTime() / 1000,
          },
        },
      },
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_t',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({usageExceeded: false}),
        monitorSeats: MetricHistoryFixture({usageExceeded: false}),
      },
      canSelfServe: true,
      onDemandPeriodEnd: '2020-02-02',
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows add quota btn for paid plans for admins for warnings', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-1',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({sentUsageWarning: true, usageExceeded: true}),
        transactions: MetricHistoryFixture({sentUsageWarning: false}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({sentUsageWarning: false}),
        monitorSeats: MetricHistoryFixture({sentUsageWarning: false}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByRole('button', {name: /setup on-demand/i})
    ).toBeInTheDocument();
  });

  // TODO(isabella): move this to addEventsCTA.spec.tsx
  it('shows add quota button for paid plans warnings with no active product trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-1',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      categories: {
        errors: MetricHistoryFixture({sentUsageWarning: false}),
        spans: MetricHistoryFixture({sentUsageWarning: false}),
        replays: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({sentUsageWarning: false}),
        monitorSeats: MetricHistoryFixture({sentUsageWarning: false}),
        profileDuration: MetricHistoryFixture({sentUsageWarning: false}),
        profileDurationUI: MetricHistoryFixture({sentUsageWarning: false}),
      },
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.REPLAYS,
          reasonCode: 1001,
          isStarted: false,
          lengthDays: undefined,
          startDate: undefined,
          endDate: undefined,
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByRole('button', {name: /setup pay-as-you-go/i})
    ).toBeInTheDocument();
  });

  it('does not show warning if on-demand is set', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-1',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {errors: MetricHistoryFixture({sentUsageWarning: true})},
      canSelfServe: true,
      onDemandMaxSpend: 10,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(
      screen.queryByRole('button', {name: /setup on-demand/i})
    ).not.toBeInTheDocument();
  });

  it('does not show warning if active product trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-1',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {monitorSeats: MetricHistoryFixture({sentUsageWarning: true})},
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.MONITOR_SEATS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(20, 'days').format(),
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows warning even if other category is on active trial', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-1',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({sentUsageWarning: true}),
        monitorSeats: MetricHistoryFixture({sentUsageWarning: true}),
      },
      canSelfServe: true,
      productTrials: [
        {
          category: DataCategory.MONITOR_SEATS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(20, 'days').format(),
        },
      ],
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(await screen.findByTestId('overage-banner-error')).toBeInTheDocument();
    expect(screen.queryByTestId('overage-banner-monitorSeat')).not.toBeInTheDocument();
  });

  it('does not show alert if hasOverageNotificationsDisabled is set', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-2',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: true}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
      hasOverageNotificationsDisabled: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show warning if hasOverageNotificationsDisabled is set', async function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
      slug: 'another-slug-4',
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({
          category: DataCategory.ERRORS,
          sentUsageWarning: true,
        }),
        transactions: MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          sentUsageWarning: true,
        }),
        replays: MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          sentUsageWarning: true,
        }),
        attachments: MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          sentUsageWarning: true,
        }),
        monitorSeats: MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          sentUsageWarning: true,
        }),
      },
      canSelfServe: true,
      hasOverageNotificationsDisabled: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render overage banner without grace period and usage exceeded', async function () {
    const organization = OrganizationFixture({
      slug: 'soft-cap',
      access: ['org:billing'],
    });
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        isGracePeriod: false,
        usageExceeded: false,
      })
    );

    render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(screen.queryByTestId('grace-period-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-exceeded-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal-usage-exceeded')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal-grace-period')).not.toBeInTheDocument();
  });

  it('shows specific banner text just for single seat-based overage', async function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: false}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
        profileDuration: MetricHistoryFixture({usageExceeded: false}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByText(
        "We can't enable additional Cron Monitors because you don't have a sufficient on-demand budget."
      )
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', {name: 'Setup On-Demand'})
    ).toBeInTheDocument();
  });

  it('shows specific banner text just for multiple seat-based overage', async function () {
    const organization = OrganizationFixture({access: ['org:billing']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: false}),
        transactions: MetricHistoryFixture({usageExceeded: false}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: false}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
        profileDuration: MetricHistoryFixture({usageExceeded: false}),
        uptime: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByText(
        "We can't enable additional Cron Monitors and Uptime Monitors because you don't have a sufficient on-demand budget."
      )
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', {name: 'Setup On-Demand'})
    ).toBeInTheDocument();
  });

  it('shows overage alert banner for single category', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(await screen.findByTestId('overage-banner-error')).toBeInTheDocument();
  });

  it('shows overage alert banner for multiple categories', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      categories: {
        errors: MetricHistoryFixture({usageExceeded: true}),
        transactions: MetricHistoryFixture({usageExceeded: true}),
        spans: MetricHistoryFixture({usageExceeded: true}),
        replays: MetricHistoryFixture({usageExceeded: false}),
        attachments: MetricHistoryFixture({usageExceeded: true}),
        monitorSeats: MetricHistoryFixture({usageExceeded: true}),
        uptime: MetricHistoryFixture({usageExceeded: true}),
        seerAutofix: MetricHistoryFixture({usageExceeded: true}),
        seerScanner: MetricHistoryFixture({usageExceeded: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId(
        'overage-banner-error-transaction-attachment-span-monitorSeat-uptime-seerAutofix-seerScanner'
      )
    ).toBeInTheDocument();
  });

  it('shows overage warning banner for single category', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      categories: {
        errors: MetricHistoryFixture({sentUsageWarning: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(await screen.findByTestId('overage-banner-error')).toBeInTheDocument();
  });

  it('shows overage warning banner for multiple categories', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      categories: {
        errors: MetricHistoryFixture({sentUsageWarning: true}),
        transactions: MetricHistoryFixture({sentUsageWarning: true}),
        spans: MetricHistoryFixture({sentUsageWarning: true}),
        replays: MetricHistoryFixture({sentUsageWarning: false}),
        attachments: MetricHistoryFixture({sentUsageWarning: true}),
        monitorSeats: MetricHistoryFixture({sentUsageWarning: true}),
        uptime: MetricHistoryFixture({sentUsageWarning: true}),
        seerAutofix: MetricHistoryFixture({sentUsageWarning: true}),
        seerScanner: MetricHistoryFixture({sentUsageWarning: true}),
      },
      canSelfServe: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });

    expect(
      await screen.findByTestId(
        'overage-banner-error-transaction-attachment-span-monitorSeat-uptime-seerAutofix-seerScanner'
      )
    ).toBeInTheDocument();
  });

  it('checks prompts for all billed categories on plan', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    const promptsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<GSBanner organization={organization} />, {
      organization,
    });
    await act(tick);

    const overagePrompts = [];
    const warningPrompts = [];
    const productTrialPrompts = [];
    for (const category of [
      'errors',
      'attachments',
      'replays',
      'spans',
      'monitor_seats',
      'profile_duration',
      'profile_duration_ui',
      'uptime',
      'seer_autofix',
      'seer_scanner',
    ]) {
      overagePrompts.push(`${category}_overage_alert`);
      warningPrompts.push(`${category}_warning_alert`);
      if (
        ['profile_duration', 'replays', 'spans', 'profile_duration_ui'].includes(category)
      ) {
        productTrialPrompts.push(`${category}_product_trial_alert`);
      }
    }

    expect(promptsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/prompts-activity/`,
      expect.objectContaining({
        query: {
          feature: [
            'deactivated_member_alert',
            ...overagePrompts,
            ...warningPrompts,
            ...productTrialPrompts,
          ],
          organization_id: organization.id,
        },
      })
    );
  });

  it('does not show banner for non-billed categories', async function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      categories: {
        // this would never happen in practice, but we're asserting that we properly filter out non-billed categories
        logBytes: MetricHistoryFixture({usageExceeded: true}),
        logItems: MetricHistoryFixture({usageExceeded: true}),
        profileChunks: MetricHistoryFixture({usageExceeded: true}),
      },
    });
    subscription.planDetails.categories = [
      ...subscription.planDetails.categories,
      DataCategory.LOG_BYTE,
      DataCategory.LOG_ITEM,
      DataCategory.PROFILE_CHUNKS,
    ];
    SubscriptionStore.set(organization.slug, subscription);

    const promptsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
    });

    render(<GSBanner organization={organization} />, {
      organization,
    });

    const {container} = render(<GSBanner organization={organization} />, {
      organization,
    });

    await act(tick);
    expect(container).toBeEmptyDOMElement();
    const lastCall = promptsMock.mock.lastCall;
    const nonBilledOveragePrompts = [
      'log_bytes_overage_alert',
      'log_items_overage_alert',
      'profile_chunks_overage_alert',
    ];
    expect(
      (lastCall[1].query.feature as string[]).some(prompt =>
        nonBilledOveragePrompts.includes(prompt)
      )
    ).toBe(false);
  });
});
