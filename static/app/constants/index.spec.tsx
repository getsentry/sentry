import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategoryExact} from 'sentry/types/core';

describe('DATA_CATEGORY_INFO', () => {
  describe('formatting property', () => {
    it('all categories have formatting info', () => {
      const categories = Object.values(DataCategoryExact);
      for (const category of categories) {
        expect(DATA_CATEGORY_INFO[category]).toBeDefined();
        expect(DATA_CATEGORY_INFO[category].formatting).toBeDefined();
      }
    });

    it('byte categories have correct formatting', () => {
      const byteCategories = [DataCategoryExact.ATTACHMENT, DataCategoryExact.LOG_BYTE];

      for (const category of byteCategories) {
        const {formatting} = DATA_CATEGORY_INFO[category];
        expect(formatting.unitType).toBe('bytes');
        expect(formatting.reservedMultiplier).toBe(10 ** 9); // GIGABYTE
        expect(formatting.bigNumUnit).toBe(1);
        expect(formatting.priceFormatting.minFractionDigits).toBe(2);
        expect(formatting.priceFormatting.maxFractionDigits).toBe(2);
      }
    });

    it('attachment category uses non-abbreviated projected format', () => {
      const {formatting} = DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT];
      expect(formatting.projectedAbbreviated).toBe(false);
    });

    it('log byte category uses abbreviated projected format', () => {
      const {formatting} = DATA_CATEGORY_INFO[DataCategoryExact.LOG_BYTE];
      expect(formatting.projectedAbbreviated).toBe(true);
    });

    it('duration hour categories have correct formatting', () => {
      const durationCategories = [
        DataCategoryExact.PROFILE_DURATION,
        DataCategoryExact.PROFILE_DURATION_UI,
      ];

      for (const category of durationCategories) {
        const {formatting} = DATA_CATEGORY_INFO[category];
        expect(formatting.unitType).toBe('durationHours');
        expect(formatting.reservedMultiplier).toBe(3_600_000); // MILLISECONDS_IN_HOUR
        expect(formatting.bigNumUnit).toBe(0);
        expect(formatting.priceFormatting.minFractionDigits).toBe(5);
        expect(formatting.priceFormatting.maxFractionDigits).toBe(7);
        expect(formatting.projectedAbbreviated).toBe(true);
      }
    });

    it('count categories have correct formatting', () => {
      const countCategories = [
        DataCategoryExact.ERROR,
        DataCategoryExact.TRANSACTION,
        DataCategoryExact.REPLAY,
        DataCategoryExact.SPAN,
        DataCategoryExact.MONITOR_SEAT,
      ];

      for (const category of countCategories) {
        const {formatting} = DATA_CATEGORY_INFO[category];
        expect(formatting.unitType).toBe('count');
        expect(formatting.reservedMultiplier).toBe(1);
        expect(formatting.bigNumUnit).toBe(0);
        expect(formatting.priceFormatting.minFractionDigits).toBe(5);
        expect(formatting.priceFormatting.maxFractionDigits).toBe(7);
        expect(formatting.projectedAbbreviated).toBe(true);
      }
    });

    it('formatting unitType matches expected categories', () => {
      const bytesCategories = [DataCategoryExact.ATTACHMENT, DataCategoryExact.LOG_BYTE];
      const durationHoursCategories = [
        DataCategoryExact.PROFILE_DURATION,
        DataCategoryExact.PROFILE_DURATION_UI,
      ];

      // Check bytes categories
      for (const category of bytesCategories) {
        expect(DATA_CATEGORY_INFO[category].formatting.unitType).toBe('bytes');
      }

      // Check duration categories
      for (const category of durationHoursCategories) {
        expect(DATA_CATEGORY_INFO[category].formatting.unitType).toBe('durationHours');
      }

      // All other categories should be count
      const allCategories = Object.values(DataCategoryExact);
      const nonCountCategories = [...bytesCategories, ...durationHoursCategories];

      for (const category of allCategories) {
        if (!nonCountCategories.includes(category)) {
          expect(DATA_CATEGORY_INFO[category].formatting.unitType).toBe('count');
        }
      }
    });
  });
});
