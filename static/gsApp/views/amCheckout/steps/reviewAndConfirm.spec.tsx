import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {InvoicePreviewFixture} from 'getsentry-test/fixtures/invoicePreview';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {browserHistory} from 'sentry/utils/browserHistory';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import AMCheckout from 'getsentry/views/amCheckout/';

import {getCheckoutAPIData} from '../utils';

import ReviewAndConfirm from './reviewAndConfirm';

jest.mock('sentry/actionCreators/indicator');
jest.mock('getsentry/utils/trackGetsentryAnalytics');
jest.mock('getsentry/utils/stripe', () => ({
  loadStripe: (cb: any) => {
    if (!cb) {
      return;
    }
    cb(() => ({
      handleCardAction(secretKey: string, _options: any) {
        if (secretKey === 'ERROR') {
          return new Promise(resolve => {
            resolve({error: {message: 'Invalid card', type: 'card_error'}});
          });
        }
        if (secretKey === 'GENERIC_ERROR') {
          return new Promise(resolve => {
            resolve({
              error: {
                message: 'Something bad that users should not see',
                type: 'internal_error',
              },
            });
          });
        }
        return new Promise(resolve => {
          resolve({setupIntent: {payment_method: 'pm_abc123'}});
        });
      },
    }));
  },
}));

describe('AmCheckout > ReviewAndConfirm', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  const bizPlan = PlanDetailsLookupFixture('am1_business')!;
  const billingConfig = BillingConfigFixture(PlanTier.AM2);

  const formData = {
    plan: billingConfig.defaultPlan,
    reserved: billingConfig.defaultReserved,
  };

  const stepProps = {
    stepNumber: 6,
    onUpdate: jest.fn(),
    onCompleteStep: jest.fn(),
    onEdit: jest.fn(),
    billingConfig,
    formData,
    activePlan: bizPlan,
    organization,
    subscription,
    isActive: false,
    isCompleted: false,
    prevStepCompleted: false,
  };

  function mockPreviewGet(slug = organization.slug, effectiveAt: Date | null = null) {
    const preview = InvoicePreviewFixture();
    if (effectiveAt) {
      preview.effectiveAt = effectiveAt.toISOString();
    }
    const mockPreview = MockApiClient.addMockResponse({
      url: `/customers/${slug}/subscription/preview/`,
      method: 'GET',
      body: preview,
    });
    return {mockPreview, preview};
  }

  function mockSubscriptionPut(mockParams = {}, slug = organization.slug) {
    return MockApiClient.addMockResponse({
      url: `/customers/${slug}/subscription/`,
      method: 'PUT',
      ...mockParams,
    });
  }

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'GET',
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [ProjectFixture({})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
    });
  });

  it('cannot skip to review step', async function () {
    mockPreviewGet();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={subscription.planTier as PlanTier}
      />
    );

    const heading = await screen.findByText('Review & Confirm');
    expect(heading).toBeInTheDocument();

    // Submit should not be visible
    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();

    // Clicking the heading should not reveal the submit button
    await userEvent.click(heading);
    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();
  });

  it('renders closed', function () {
    const {mockPreview} = mockPreviewGet();
    render(<ReviewAndConfirm {...stepProps} />);

    // Submit should not be visible
    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('renders open when active', async function () {
    const {preview, mockPreview} = mockPreviewGet();
    render(<ReviewAndConfirm {...stepProps} isActive />);

    expect(
      await screen.findByText(preview.invoiceItems[0]!.description)
    ).toBeInTheDocument();
    expect(screen.getByText(preview.invoiceItems[1]!.description)).toBeInTheDocument();
    expect(screen.getByText(preview.invoiceItems[2]!.description)).toBeInTheDocument();
    expect(screen.getByText(preview.invoiceItems[3]!.description)).toBeInTheDocument();

    expect(screen.getByTestId('dates')).toBeInTheDocument();
    expect(screen.getAllByText('$89')).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Confirm Changes'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Migrate Now'})).not.toBeInTheDocument();

    expect(mockPreview).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/preview/`,
      expect.objectContaining({
        method: 'GET',
        data: getCheckoutAPIData({formData, isPreview: true}),
      })
    );
  });

  it('requests preview with ondemand spend', async function () {
    const {mockPreview, preview} = mockPreviewGet();
    const updatedData = {...formData, onDemandMaxSpend: 5000};
    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);

    expect(
      await screen.findByText(preview.invoiceItems[0]!.description)
    ).toBeInTheDocument();

    expect(mockPreview).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/preview/`,
      expect.objectContaining({
        method: 'GET',
        data: getCheckoutAPIData({formData: updatedData, isPreview: true}),
      })
    );
  });

  it('updates preview with formData change when active', async function () {
    const {preview, mockPreview} = mockPreviewGet();
    const {rerender} = render(<ReviewAndConfirm {...stepProps} />);
    expect(await screen.findByText('Review & Confirm')).toBeInTheDocument();
    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();
    expect(mockPreview).not.toHaveBeenCalled();

    const updatedData = {...formData, plan: 'am1_business_auf'};
    rerender(<ReviewAndConfirm {...stepProps} isActive formData={updatedData} />);

    // Wait for invoice to render.
    expect(
      await screen.findByText(preview.invoiceItems[0]!.description)
    ).toBeInTheDocument();
    expect(screen.getByText('Confirm Changes')).toBeInTheDocument();

    expect(mockPreview).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/preview/`,
      expect.objectContaining({
        method: 'GET',
        data: getCheckoutAPIData({formData: updatedData, isPreview: true}),
      })
    );
  });

  it('can confirm changes', async function () {
    const {preview} = mockPreviewGet();
    const mockConfirm = mockSubscriptionPut();

    const reservedErrors = 100000;
    const updatedData = {
      ...formData,
      reserved: {...formData.reserved, errors: reservedErrors},
    };
    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);

    await userEvent.click(await screen.findByText('Confirm Changes'));
    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith('checkout.upgrade', {
      organization,
      subscription,
      previous_plan: 'am1_f',
      previous_errors: 5000,
      previous_transactions: 10_000,
      previous_attachments: 1,
      previous_replays: 50,
      previous_monitorSeats: 1,
      previous_profileDuration: undefined,
      previous_spans: undefined,
      plan: updatedData.plan,
      errors: updatedData.reserved.errors,
      transactions: updatedData.reserved.transactions,
      attachments: updatedData.reserved.attachments,
      replays: updatedData.reserved.replays,
      monitorSeats: updatedData.reserved.monitorSeats,
      spans: undefined,
    });

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'checkout.transactions_upgrade',
      {
        organization,
        subscription,
        plan: updatedData.plan,
        transactions: updatedData.reserved.transactions,
        previous_transactions: 10_000,
      }
    );
  });

  it('can schedule changes for partner migration', async function () {
    const partnerOrg = OrganizationFixture({features: ['partner-billing-migration']});
    const partnerSub = SubscriptionFixture({
      organization: partnerOrg,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
      contractPeriodEnd: moment().add(7, 'days').toString(),
    });
    const {preview} = mockPreviewGet(partnerOrg.slug);
    const mockConfirm = mockSubscriptionPut(partnerOrg.slug);

    const updatedData = {
      plan: 'am3_business',
      reserved: {
        errors: 100_000,
        replays: 5000,
        spans: 10_000_000,
        attachments: 1,
        monitorSeats: 1,
        profileDuration: 0,
      },
    };

    const partnerStepProps = {
      ...stepProps,
      organization: partnerOrg,
      subscription: partnerSub,
    };

    render(<ReviewAndConfirm {...partnerStepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `These changes will take effect at the end of your current FOO sponsored plan on ${moment(partnerSub.contractPeriodEnd).add(1, 'days').format('ll')}. If you want these changes to apply immediately, select Migrate Now.`
      )
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Schedule Changes'));
    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${partnerOrg.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${partnerOrg.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith('checkout.upgrade', {
      organization: partnerOrg,
      subscription: partnerSub,
      previous_plan: 'am1_f',
      previous_errors: 5000,
      previous_transactions: 10_000,
      previous_attachments: 1,
      previous_replays: 50,
      previous_monitorSeats: 1,
      previous_profileDuration: undefined,
      previous_spans: undefined,
      plan: updatedData.plan,
      errors: updatedData.reserved.errors,
      transactions: undefined,
      attachments: updatedData.reserved.attachments,
      replays: updatedData.reserved.replays,
      monitorSeats: updatedData.reserved.monitorSeats,
      spans: updatedData.reserved.spans,
      profileDuration: updatedData.reserved.profileDuration,
    });

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'partner_billing_migration.checkout.completed',
      {
        organization: partnerOrg,
        subscription: partnerSub,
        applyNow: false,
        daysLeft: 7,
        partner: 'FOO',
      }
    );
  });

  it('can migrate immediately for partner migration', async function () {
    const partnerOrg = OrganizationFixture({features: ['partner-billing-migration']});
    const partnerSub = SubscriptionFixture({
      organization: partnerOrg,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
      contractPeriodEnd: moment().add(20, 'days').toString(),
    });
    const {preview} = mockPreviewGet(partnerOrg.slug);
    const mockConfirm = mockSubscriptionPut(partnerOrg.slug);

    const updatedData = {
      plan: 'am3_business',
      reserved: {
        errors: 100_000,
        replays: 5000,
        spans: 10_000_000,
        attachments: 1,
        monitorSeats: 1,
      },
    };
    const partnerStepProps = {
      ...stepProps,
      organization: partnerOrg,
      subscription: partnerSub,
    };

    render(<ReviewAndConfirm {...partnerStepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `These changes will take effect at the end of your current FOO sponsored plan on ${moment(partnerSub.contractPeriodEnd).add(1, 'days').format('ll')}. If you want these changes to apply immediately, select Migrate Now.`
      )
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Migrate Now'));
    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${partnerOrg.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: {...updatedData, applyNow: true},
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${partnerOrg.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith('checkout.upgrade', {
      organization: partnerOrg,
      subscription: partnerSub,
      previous_plan: 'am1_f',
      previous_errors: 5000,
      previous_transactions: 10_000,
      previous_attachments: 1,
      previous_replays: 50,
      previous_monitorSeats: 1,
      previous_profileDuration: undefined,
      previous_spans: undefined,
      plan: updatedData.plan,
      errors: updatedData.reserved.errors,
      transactions: undefined,
      attachments: updatedData.reserved.attachments,
      replays: updatedData.reserved.replays,
      monitorSeats: updatedData.reserved.monitorSeats,
      spans: updatedData.reserved.spans,
    });

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'partner_billing_migration.checkout.completed',
      {
        organization: partnerOrg,
        subscription: partnerSub,
        applyNow: true,
        daysLeft: 20,
        partner: 'FOO',
      }
    );
  });

  it('should render immediate copy for effectiveNow', async function () {
    mockPreviewGet(organization.slug, new Date());
    mockSubscriptionPut(organization.slug);

    const updatedData = {
      plan: 'am3_business',
      reserved: {
        errors: 100_000,
        replays: 5000,
        spans: 10_000_000,
        attachments: 1,
        monitorSeats: 1,
      },
    };

    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `These changes will apply immediately, and you will be billed today.`
      )
    ).toBeInTheDocument();
  });

  it('should render contract end copy for effective later', async function () {
    mockPreviewGet(organization.slug);
    mockSubscriptionPut(organization.slug);

    const updatedData = {
      plan: 'am3_business',
      reserved: {
        errors: 100_000,
        replays: 5000,
        spans: 10_000_000,
        attachments: 1,
        monitorSeats: 1,
      },
    };

    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `This change will take effect at the end of your current contract period.`
      )
    ).toBeInTheDocument();

    // Expects the same copy for self serve partners
    const partnerSub = SubscriptionFixture({
      organization,
      contractPeriodEnd: moment().add(20, 'days').toString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
    });
    const partnerStepProps = {
      ...stepProps,
      subscription: partnerSub,
    };

    render(<ReviewAndConfirm {...partnerStepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `This change will take effect at the end of your current contract period.`
      )
    ).toBeInTheDocument();
  });

  it('should render billed through self serve partner copy effectiveNow', async function () {
    const partnerSub = SubscriptionFixture({
      organization,
      contractPeriodEnd: moment().add(20, 'days').toString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
    });
    mockPreviewGet(organization.slug, new Date());
    mockSubscriptionPut(organization.slug);

    const updatedData = {
      plan: 'am3_business',
      reserved: {
        errors: 100_000,
        replays: 5000,
        spans: 10_000_000,
        attachments: 1,
        monitorSeats: 1,
      },
    };
    const partnerStepProps = {
      ...stepProps,
      subscription: partnerSub,
    };

    render(<ReviewAndConfirm {...partnerStepProps} formData={updatedData} isActive />);
    expect(
      await screen.findByText(
        `These changes will apply immediately, and you will be billed today through FOO.`
      )
    ).toBeInTheDocument();
  });

  it('does not send transactions upgrade event for plan upgrade', async function () {
    const {preview} = mockPreviewGet();
    const mockConfirm = mockSubscriptionPut();
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 250_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 500}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
    });

    SubscriptionStore.set(organization.slug, sub);

    const updatedData = {...formData, plan: 'am1_business'};
    const props = {...stepProps, subscription: sub, formData: updatedData};

    render(<ReviewAndConfirm {...props} isActive />);

    await userEvent.click(await screen.findByText('Confirm Changes'));

    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith('checkout.upgrade', {
      organization,
      subscription: sub,
      previous_plan: 'am1_team',
      previous_errors: 100000,
      previous_transactions: 250000,
      previous_attachments: 1,
      previous_replays: 500,
      previous_monitorSeats: 1,
      previous_profileDuration: undefined,
      previous_spans: undefined,
      plan: 'am1_business',
      errors: updatedData.reserved.errors,
      transactions: updatedData.reserved.transactions,
      attachments: updatedData.reserved.attachments,
      replays: updatedData.reserved.replays,
      monitorSeats: updatedData.reserved.monitorSeats,
      spans: undefined,
    });
    expect(trackGetsentryAnalytics).not.toHaveBeenCalledWith(
      'checkout.transactions_upgrade'
    );
  });

  it('does not send transactions upgrade event for transactions downgrade', async function () {
    const {preview} = mockPreviewGet();
    const mockConfirm = mockSubscriptionPut();
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      categories: {
        errors: MetricHistoryFixture({reserved: 100000}),
        transactions: MetricHistoryFixture({reserved: 500000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 500}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
    });

    SubscriptionStore.set(organization.slug, sub);

    const updatedData = {...formData};
    const props = {...stepProps, subscription: sub, formData: updatedData};
    render(<ReviewAndConfirm {...props} isActive />);

    await userEvent.click(await screen.findByText('Confirm Changes'));
    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(trackGetsentryAnalytics).toHaveBeenCalledWith('checkout.upgrade', {
      organization,
      subscription: sub,
      previous_plan: 'am1_team',
      previous_errors: 100000,
      previous_transactions: 500000,
      previous_attachments: 1,
      previous_replays: 500,
      previous_monitorSeats: 1,
      previous_profileDuration: undefined,
      previous_spans: undefined,
      plan: updatedData.plan,
      errors: updatedData.reserved.errors,
      transactions: updatedData.reserved.transactions,
      attachments: updatedData.reserved.attachments,
      replays: updatedData.reserved.replays,
      monitorSeats: updatedData.reserved.monitorSeats,
      spans: undefined,
    });

    expect(trackGetsentryAnalytics).not.toHaveBeenCalledWith(
      'checkout.transactions_upgrade'
    );
  });

  it('can confirm with ondemand spend', async function () {
    const {preview} = mockPreviewGet();
    const mockConfirm = mockSubscriptionPut();
    const updatedData = {...formData, reserved: {errors: 100000}, onDemandMaxSpend: 5000};
    render(<ReviewAndConfirm {...stepProps} isActive formData={updatedData} />);
    await userEvent.click(await screen.findByText('Confirm Changes'));

    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    // No DOM updates to wait on, but we can use this.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );
  });

  it('handles expired token on confirm', async function () {
    const {preview, mockPreview} = mockPreviewGet();
    const mockConfirm = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      statusCode: 400,
      body: {
        previewToken: ['The preview token is invalid or has expired.'],
      },
    });

    const updatedData = {...formData, reservedErrors: 100000};
    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);
    expect(mockPreview).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByText('Confirm Changes'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        `/customers/${organization.slug}/subscription/`,
        expect.objectContaining({
          method: 'PUT',
          data: getCheckoutAPIData({
            formData: updatedData,
            previewToken: preview.previewToken,
          }),
        })
      );
    });

    expect(mockPreview).toHaveBeenCalledTimes(2);
    expect(addErrorMessage).toHaveBeenCalledWith(
      'Your preview expired, please review changes and submit again'
    );
    expect(browserHistory.push).not.toHaveBeenCalled();
  });

  it('handles unknown error when updating subscription', async function () {
    const {preview, mockPreview} = mockPreviewGet();
    const mockConfirm = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      statusCode: 500,
    });

    const updatedData = {...formData, reservedTransactions: 1500000};
    render(<ReviewAndConfirm {...stepProps} formData={updatedData} isActive />);

    expect(mockPreview).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByText('Confirm Changes'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        `/customers/${organization.slug}/subscription/`,
        expect.objectContaining({
          method: 'PUT',
          data: getCheckoutAPIData({
            formData: updatedData,
            previewToken: preview.previewToken,
          }),
        })
      );
    });

    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(addErrorMessage).toHaveBeenCalledWith(
      'An unknown error occurred while saving your subscription'
    );
    expect(browserHistory.push).not.toHaveBeenCalled();
  });

  it('handles completing a card action when required', async function () {
    const {preview} = mockPreviewGet();
    // We make two API calls. The first fails with a card action required
    // which we have mocked to succeed. The second request will have
    // the intent to complete payment with.
    const mockConfirm = mockSubscriptionPut({
      statusCode: 402,
      body: {
        detail: 'Card action required',
        paymentIntent: 'pi_abc123',
        paymentSecret: 'pi_abc123-secret',
      },
    });
    const mockComplete = mockSubscriptionPut({
      statusCode: 200,
      body: subscription,
      match: [MockApiClient.matchData({paymentIntent: 'pi_abc123'})],
    });

    const updatedData = {...formData, reserved: {errors: 100000}, onDemandMaxSpend: 5000};
    render(<ReviewAndConfirm {...stepProps} isActive formData={updatedData} />);
    await userEvent.click(await screen.findByText('Confirm Changes'));

    // Wait for URL to change as that signals completion.
    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith(
        `/settings/${organization.slug}/billing/overview/?open_codecov_modal=1&referrer=checkout`
      )
    );

    expect(mockConfirm).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
        }),
      })
    );
    expect(mockComplete).toHaveBeenCalledWith(
      `/customers/${organization.slug}/subscription/`,
      expect.objectContaining({
        method: 'PUT',
        data: getCheckoutAPIData({
          formData: updatedData,
          previewToken: preview.previewToken,
          paymentIntent: 'pi_abc123',
        }),
      })
    );
  });

  it('handles payment intent errors', async function () {
    mockPreviewGet();
    const mockConfirm = mockSubscriptionPut({
      statusCode: 402,
      body: {
        detail: 'Card action required',
        paymentIntent: 'pi_abc123',
        paymentSecret: 'ERROR',
      },
    });

    const updatedData = {...formData, reserved: {errors: 100000}, onDemandMaxSpend: 5000};
    render(<ReviewAndConfirm {...stepProps} isActive formData={updatedData} />);
    const button = await screen.findByRole('button', {name: 'Confirm Changes'});
    await userEvent.click(button);

    expect(await screen.findByText('Invalid card')).toBeInTheDocument();
    // Because our payment confirmation failed we can't continue
    expect(button).toBeDisabled();
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('shows generic intent errors for odd types', async function () {
    mockPreviewGet();
    const mockConfirm = mockSubscriptionPut({
      statusCode: 402,
      body: {
        detail: 'Card action required',
        paymentIntent: 'pi_abc123',
        paymentSecret: 'GENERIC_ERROR',
      },
    });

    const updatedData = {...formData, reserved: {errors: 100000}, onDemandMaxSpend: 5000};
    render(<ReviewAndConfirm {...stepProps} isActive formData={updatedData} />);
    const button = await screen.findByRole('button', {name: 'Confirm Changes'});
    await userEvent.click(button);

    expect(
      await screen.findByText(/Your payment could not be authorized/)
    ).toBeInTheDocument();
    // Because our payment confirmation failed we can't continue
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(mockConfirm).toHaveBeenCalled();
  });
});
