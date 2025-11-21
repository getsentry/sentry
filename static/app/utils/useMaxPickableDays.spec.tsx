import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {useMaxPickableDays} from './useMaxPickableDays';

describe('useMaxPickableDays', () => {
  it.each([
    [[]],
    [[DataCategory.ERRORS, DataCategory.REPLAYS]],
    [[DataCategory.ERRORS]],
    [[DataCategory.REPLAYS]],
  ])('returns undefined for %s', dataCategories => {
    const {result} = renderHookWithProviders(() =>
      useMaxPickableDays({
        dataCategories,
        organization: OrganizationFixture(),
      })
    );

    expect(result.current).toEqual({
      maxPickableDays: undefined,
      maxUpgradableDays: undefined,
    });
  });

  it('returns 30/30 days for logs', () => {
    const {result} = renderHookWithProviders(() =>
      useMaxPickableDays({
        dataCategories: [DataCategory.LOG_BYTE, DataCategory.LOG_ITEM],
        organization: OrganizationFixture(),
      })
    );

    expect(result.current).toEqual({
      defaultPeriod: '24h',
      maxPickableDays: 30,
      maxUpgradableDays: 30,
    });
  });

  it('returns 30/90 for spans without flag', () => {
    const {result} = renderHookWithProviders(() =>
      useMaxPickableDays({
        dataCategories: [DataCategory.SPANS],
        organization: OrganizationFixture({features: []}),
      })
    );

    expect(result.current).toEqual({
      maxPickableDays: 30,
      maxUpgradableDays: 90,
      upsellFooter: expect.any(Object),
    });
  });

  it('returns 90/90 for spans with flag', () => {
    const {result} = renderHookWithProviders(() =>
      useMaxPickableDays({
        dataCategories: [DataCategory.SPANS],
        organization: OrganizationFixture({features: ['visibility-explore-range-high']}),
      })
    );

    expect(result.current).toEqual({
      maxPickableDays: 90,
      maxUpgradableDays: 90,
      upsellFooter: expect.any(Object),
    });
  });

  it('returns 30/90 for many without flag', () => {
    const {result} = renderHookWithProviders(() =>
      useMaxPickableDays({
        dataCategories: [
          DataCategory.PROFILE_DURATION,
          DataCategory.PROFILE_DURATION_UI,
          DataCategory.LOG_BYTE,
          DataCategory.LOG_ITEM,
          DataCategory.SPANS,
        ],
        organization: OrganizationFixture(),
      })
    );

    expect(result.current).toEqual({
      maxPickableDays: 30,
      maxUpgradableDays: 90,
      upsellFooter: expect.any(Object),
    });
  });
});
