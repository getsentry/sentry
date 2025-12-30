import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import {useMaxPickableDays} from './useMaxPickableDays';

describe('useMaxPickableDays', () => {
  describe('without downsampled-date-page-filter', () => {
    it('returns 90/90 for transactions', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [DataCategory.TRANSACTIONS],
        })
      );

      expect(result.current).toEqual({
        maxPickableDays: 90,
        maxUpgradableDays: 90,
      });
    });

    it('returns 90/90 for replays', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [DataCategory.REPLAYS],
        })
      );

      expect(result.current).toEqual({
        maxPickableDays: 90,
        maxUpgradableDays: 90,
      });
    });

    it('returns 30/90 for spans without flag', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [DataCategory.SPANS],
        })
      );

      expect(result.current).toEqual({
        maxPickableDays: 30,
        maxUpgradableDays: 90,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 90/90 for spans with flag', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.SPANS],
          }),
        {
          organization: OrganizationFixture({
            features: ['visibility-explore-range-high'],
          }),
        }
      );

      expect(result.current).toEqual({
        maxPickableDays: 90,
        maxUpgradableDays: 90,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 30/30 days for tracemetrics', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [DataCategory.TRACE_METRICS],
        })
      );

      expect(result.current).toEqual({
        defaultPeriod: '24h',
        maxPickableDays: 30,
        maxUpgradableDays: 30,
      });
    });

    it('returns 30/30 days for logs', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [DataCategory.LOG_BYTE, DataCategory.LOG_ITEM],
        })
      );

      expect(result.current).toEqual({
        defaultPeriod: '24h',
        maxPickableDays: 30,
        maxUpgradableDays: 30,
      });
    });

    it('returns 30/90 for many without flag', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [
            DataCategory.SPANS,
            DataCategory.SPANS_INDEXED,
            DataCategory.TRACE_METRICS,
            DataCategory.LOG_BYTE,
            DataCategory.LOG_ITEM,
          ],
        })
      );

      expect(result.current).toEqual({
        maxPickableDays: 30,
        maxUpgradableDays: 90,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 90/90 for profiles', () => {
      const {result} = renderHookWithProviders(() =>
        useMaxPickableDays({
          dataCategories: [
            DataCategory.PROFILE_CHUNKS,
            DataCategory.PROFILE_CHUNKS_UI,
            DataCategory.PROFILE_DURATION,
            DataCategory.PROFILE_DURATION_UI,
          ],
        })
      );

      expect(result.current).toEqual({
        maxPickableDays: 90,
        maxUpgradableDays: 90,
      });
    });
  });

  describe('with downsampled-date-page-filter', () => {
    const organization = OrganizationFixture({
      features: ['downsampled-date-page-filter'],
    });

    const subscription = SubscriptionFixture({
      organization,
      effectiveRetentions: {
        span: {
          standard: 90,
          downsampled: 396,
        },
      },
    });

    beforeEach(() => {
      SubscriptionStore.set(organization.slug, subscription);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('returns 30/90 for transactions', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.TRANSACTIONS],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 30,
        maxUpgradableDays: 90,
      });
    });

    it('returns 30/90 for replays', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.REPLAYS],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 30,
        maxUpgradableDays: 90,
      });
    });

    it('returns 121/121 for spans on 2025/12/31', () => {
      jest.useFakeTimers().setSystemTime(new Date(2025, 11, 31));
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.SPANS],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 121,
        maxUpgradableDays: 121,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 396/396 for spans on 2027/01/01', () => {
      jest.useFakeTimers().setSystemTime(new Date(2027, 0, 1));
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.SPANS],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 396,
        maxUpgradableDays: 396,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 30/30 days for tracemetrics', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.TRACE_METRICS],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        defaultPeriod: '24h',
        maxPickableDays: 30,
        maxUpgradableDays: 30,
      });
    });

    it('returns 30/30 days for logs', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [DataCategory.LOG_BYTE, DataCategory.LOG_ITEM],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        defaultPeriod: '24h',
        maxPickableDays: 30,
        maxUpgradableDays: 30,
      });
    });

    it('returns 396/396 for many without flag', () => {
      jest.useFakeTimers().setSystemTime(new Date(2027, 0, 1));
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [
              DataCategory.SPANS,
              DataCategory.SPANS_INDEXED,
              DataCategory.TRACE_METRICS,
              DataCategory.LOG_BYTE,
              DataCategory.LOG_ITEM,
            ],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 396,
        maxUpgradableDays: 396,
        upsellFooter: expect.any(Object),
      });
    });

    it('returns 30/90 for profiles', () => {
      const {result} = renderHookWithProviders(
        () =>
          useMaxPickableDays({
            dataCategories: [
              DataCategory.PROFILE_CHUNKS,
              DataCategory.PROFILE_CHUNKS_UI,
              DataCategory.PROFILE_DURATION,
              DataCategory.PROFILE_DURATION_UI,
            ],
          }),
        {organization}
      );

      expect(result.current).toEqual({
        maxPickableDays: 30,
        maxUpgradableDays: 30,
        defaultPeriod: '24h',
      });
    });
  });
});
