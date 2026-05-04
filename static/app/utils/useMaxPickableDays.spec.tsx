import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';

import {
  getDefaultMaxPickableDays,
  INCREASED_MAX_PICKABLE_DAYS,
  useMaxPickableDays,
} from './useMaxPickableDays';

describe('useMaxPickableDays', () => {
  beforeEach(() => {
    ConfigStore.loadInitialData(ConfigFixture());
  });

  it('returns 180 for self-hosted flagged organizations', () => {
    ConfigStore.set('isSelfHosted', true);

    expect(
      getDefaultMaxPickableDays(
        OrganizationFixture({features: ['visibility-increased-max-pickable-days']})
      )
    ).toBe(INCREASED_MAX_PICKABLE_DAYS);
  });

  it('returns 90 for SaaS organizations even with the flag', () => {
    expect(
      getDefaultMaxPickableDays(
        OrganizationFixture({features: ['visibility-increased-max-pickable-days']})
      )
    ).toBe(90);
  });

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

  it('returns 180/180 days for trace metrics on self-hosted with the flag', () => {
    ConfigStore.set('isSelfHosted', true);

    const {result} = renderHookWithProviders(
      () =>
        useMaxPickableDays({
          dataCategories: [DataCategory.TRACE_METRICS],
        }),
      {
        organization: OrganizationFixture({
          features: ['visibility-increased-max-pickable-days'],
        }),
      }
    );

    expect(result.current).toEqual({
      defaultPeriod: '24h',
      maxPickableDays: 180,
      maxUpgradableDays: 180,
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
