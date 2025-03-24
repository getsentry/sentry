import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import {BillingType} from 'getsentry/types';

import {useGenAiConsentButtonAccess} from './genAiAccess';

// Mock the hooks that useGenAiConsentButtonAccess depends on
jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useUser');
jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockUseOrganization = jest.requireMock('sentry/utils/useOrganization').default;
const mockUseUser = jest.requireMock('sentry/utils/useUser').useUser;
const mockGetRegionData =
  jest.requireMock('sentry/utils/regions').getRegionDataFromOrganization;

describe('useGenAiConsentButtonAccess', function () {
  // Reset all mocks before each test
  beforeEach(() => {
    mockUseUser.mockReset();
    mockUseOrganization.mockReset();
    mockGetRegionData.mockReset();
  });

  describe('Region-based access', function () {
    it('disables access for non-US regions', function () {
      const organization = OrganizationFixture();
      const subscription = SubscriptionFixture({organization});

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'de'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message: 'This feature is not available in your region.',
          isUsRegion: false,
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

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
          isUsRegion: true,
        })
      );
    });
  });

  describe('Touch Customer MSA Updates', function () {
    it('disables access for touch customers without MSA update', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: false,
      });

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message:
            'These changes require updates to your account. Please contact your customer success manager to learn more.',
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });

    it('enables access for touch customers with MSA update', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: true,
      });

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: false,
          message: null,
          isTouchCustomerAndNeedsMsaUpdate: false,
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

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

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

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: true});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

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

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

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
    it('prioritizes region restriction over MSA update requirement', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: false,
      });

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'eu'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message: 'This feature is not available in your region.',
          isUsRegion: false,
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });

    it('handles undefined msaUpdatedForDataConsent', function () {
      const organization = OrganizationFixture({
        access: ['org:billing'],
      });
      const subscription = SubscriptionFixture({
        organization,
        type: BillingType.INVOICED,
        msaUpdatedForDataConsent: undefined,
      });

      mockUseOrganization.mockReturnValue(organization);
      mockGetRegionData.mockReturnValue({name: 'us'});
      mockUseUser.mockReturnValue({isSuperuser: false});

      const {result} = renderHook(() => useGenAiConsentButtonAccess({subscription}));

      expect(result.current).toEqual(
        expect.objectContaining({
          isDisabled: true,
          message:
            'These changes require updates to your account. Please contact your customer success manager to learn more.',
          isTouchCustomerAndNeedsMsaUpdate: true,
        })
      );
    });
  });
});
