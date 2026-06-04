import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {useMaxPickableDays} from './useMaxPickableDays';

describe('useMaxPickableDays', () => {
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
        organization: OrganizationFixture({features: ['visibility-explore-range-high']}),
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
});
