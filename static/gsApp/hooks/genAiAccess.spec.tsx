import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import {useUser} from 'sentry/utils/useUser';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {BillingType} from 'getsentry/types';

import {useGenAiConsentButtonAccess} from './genAiAccess';

// Mock the hooks that useGenAiConsentButtonAccess depends on
jest.mock('sentry/utils/useUser');
jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockUseUser = jest.mocked(useUser);
const mockGetRegionData = jest.mocked(getRegionDataFromOrganization);

const contextWrapper = (organization: Organization) => {
  return function ({children}: {children: React.ReactNode}) {
    return <OrganizationContext value={organization}>{children}</OrganizationContext>;
  };
};

describe('useGenAiConsentButtonAccess', function () {
  beforeEach(() => {
    mockUseUser.mockReset();
    mockGetRegionData.mockReset();
  });

  describe('Region-based access', function () {
    it('disables access for non-US regions', function () {
      const organization = OrganizationFixture();
      const subscription = SubscriptionFixture({organization});

      mockGetRegionData.mockReturnValue({
        name: 'de',
        displayName: 'Germany',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message: 'This feature is not available in your region.',
        })
      );
    });

    it('enables access for US region with proper permissions', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.CREDIT_CARD,
      });

      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
        })
      );
    });
  });

  describe('Billing Access', function () {
    it('disables access for users without billing access', function () {
      const organization = OrganizationFixture({
        access: [],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.CREDIT_CARD,
      });

      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message:
            "You don't have access to manage these billing and subscription details.",
          hasBillingAccess: false,
        })
      );
    });

    it('enables access for superusers regardless of billing access', function () {
      const organization = OrganizationFixture({
        access: [],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.CREDIT_CARD,
      });

      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: true}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
          hasBillingAccess: false,
          isSuperuser: true,
        })
      );
    });

    it('enables access for users with billing access', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.CREDIT_CARD,
      });

      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
          hasBillingAccess: true,
          isSuperuser: false,
        })
      );
    });
  });

  describe('Combined Conditions', function () {
    it('shows region restriction for EU region', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: false,
      });

      mockGetRegionData.mockReturnValue({
        name: 'eu',
        displayName: 'Europe',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message: 'This feature is not available in your region.',
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });

    it('shows region restriction for other ST region', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: false,
      });

      mockGetRegionData.mockReturnValue({
        name: 'customer1',
        displayName: 'Customer 1',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message: 'This feature is not available in your region.',
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });

    it('allows access for invoiced customers with undefined msaUpdatedForDataConsent', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: undefined,
      });

      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });
      mockUseUser.mockReturnValue(UserFixture({isSuperuser: false}));

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}), {
        wrapper: contextWrapper(organization),
      });

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });
  });
});
