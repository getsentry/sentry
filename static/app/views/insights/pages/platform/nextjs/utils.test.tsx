import {truncatePeriod} from './utils';

describe('truncatePeriod', () => {
  const testDate = new Date('2025-10-15T08:44:23.123Z'); // Wednesday

  it('should return null when start or end is null', () => {
    expect(truncatePeriod({start: null, end: testDate}, 'd')).toBe(null);
    expect(truncatePeriod({start: testDate, end: null}, 'd')).toBe(null);
    expect(truncatePeriod({start: null, end: null}, 'd')).toBe(null);
  });

  describe('seconds truncation', () => {
    it('should truncate milliseconds but keep seconds', () => {
      const result = truncatePeriod({start: testDate, end: testDate}, 's');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:44:23.000Z');
      expect(result!.end).toBe('2025-10-15T08:44:23.000Z');
    });
  });

  describe('minutes truncation', () => {
    it('should truncate seconds and milliseconds but keep minutes', () => {
      const result = truncatePeriod({start: testDate, end: testDate}, 'm');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:44:00.000Z');
      expect(result!.end).toBe('2025-10-15T08:44:00.000Z');
    });
  });

  describe('hours truncation', () => {
    it('should truncate seconds and milliseconds but keep hours and minutes', () => {
      const result = truncatePeriod({start: testDate, end: testDate}, 'h');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:44:00.000Z');
      expect(result!.end).toBe('2025-10-15T08:44:00.000Z');
    });
  });

  describe('days truncation', () => {
    it('should truncate minutes, seconds, and milliseconds but keep hours', () => {
      const result = truncatePeriod({start: testDate, end: testDate}, 'd');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:00:00.000Z');
      expect(result!.end).toBe('2025-10-15T08:00:00.000Z');
    });
  });

  describe('weeks truncation', () => {
    it('should truncate minutes, seconds, and milliseconds but keep date and hours', () => {
      const result = truncatePeriod({start: testDate, end: testDate}, 'w');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:00:00.000Z');
      expect(result!.end).toBe('2025-10-15T08:00:00.000Z');
    });

    it('should handle different dates with week truncation', () => {
      const sunday = new Date('2025-10-12T08:44:23.123Z'); // Sunday
      const result = truncatePeriod({start: sunday, end: sunday}, 'w');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-12T08:00:00.000Z');
      expect(result!.end).toBe('2025-10-12T08:00:00.000Z');
    });
  });

  describe('different start and end dates', () => {
    it('should truncate both start and end dates independently', () => {
      const startDate = new Date('2025-10-15T08:44:23.123Z'); // Wednesday
      const endDate = new Date('2025-10-16T14:30:45.567Z'); // Thursday

      const result = truncatePeriod({start: startDate, end: endDate}, 'd');

      expect(result).not.toBe(null);
      expect(result!.start).toBe('2025-10-15T08:00:00.000Z');
      expect(result!.end).toBe('2025-10-16T14:00:00.000Z');
    });

    it('should handle week truncation with different dates', () => {
      const startDate = new Date('2025-10-15T08:44:23.123Z'); // Wednesday
      const endDate = new Date('2025-10-19T14:30:45.567Z'); // Sunday

      const result = truncatePeriod({start: startDate, end: endDate}, 'w');

      expect(result).not.toBe(null);
      // Both should truncate minutes, seconds, milliseconds but keep date and hours
      expect(result!.start).toBe('2025-10-15T08:00:00.000Z'); // Wednesday with time truncated
      expect(result!.end).toBe('2025-10-19T14:00:00.000Z'); // Sunday with time truncated
    });
  });
});
