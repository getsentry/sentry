import {computeSeekBuffering} from 'sentry/components/replays/computeSeekBuffering';

const NO_SEEK = {target: -1, previous: -1};
const THRESHOLD = 200;

describe('computeSeekBuffering', () => {
  describe('no active seek', () => {
    it('returns currentPlayerTime when buffer is inactive', () => {
      const result = computeSeekBuffering(NO_SEEK, 5000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 5000, hasPassed: false});
    });

    it('returns currentPlayerTime when target equals previous', () => {
      const result = computeSeekBuffering(
        {target: 5000, previous: 5000},
        5000,
        THRESHOLD
      );
      expect(result).toEqual({isBuffering: false, displayTime: 5000, hasPassed: false});
    });
  });

  describe('forward seek', () => {
    const buffer = {target: 15000, previous: 5000};

    it('buffers and shows target when replayer is far from target', () => {
      const result = computeSeekBuffering(buffer, 5000, THRESHOLD);
      expect(result).toEqual({isBuffering: true, displayTime: 15000, hasPassed: false});
    });

    it('buffers and shows target when replayer is mid-seek', () => {
      const result = computeSeekBuffering(buffer, 10000, THRESHOLD);
      expect(result).toEqual({isBuffering: true, displayTime: 15000, hasPassed: false});
    });

    it('stops buffering but still shows target when replayer is within threshold', () => {
      const result = computeSeekBuffering(buffer, 14850, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 15000, hasPassed: false});
    });

    it('never shows a time before the target while replayer has not passed it', () => {
      for (const time of [5000, 8000, 12000, 14500, 14800, 14850, 14999]) {
        const result = computeSeekBuffering(buffer, time, THRESHOLD);
        expect(result.displayTime).toBeGreaterThanOrEqual(buffer.target);
      }
    });

    it('shows real time and signals clear when replayer reaches exact target', () => {
      const result = computeSeekBuffering(buffer, 15000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 15000, hasPassed: true});
    });

    it('shows real time and signals clear when replayer passes target', () => {
      const result = computeSeekBuffering(buffer, 15100, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 15100, hasPassed: true});
    });

    it('handles fast-forward through inactivity (large overshoot)', () => {
      const result = computeSeekBuffering(buffer, 25000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 25000, hasPassed: true});
    });

    it('displayTime never decreases as currentPlayerTime increases', () => {
      const times = [5000, 8000, 12000, 14500, 14800, 14900, 14999, 15000, 15100, 16000];
      let prevDisplay = 0;
      for (const time of times) {
        const result = computeSeekBuffering(buffer, time, THRESHOLD);
        expect(result.displayTime).toBeGreaterThanOrEqual(prevDisplay);
        prevDisplay = result.displayTime;
      }
    });
  });

  describe('backward seek', () => {
    const buffer = {target: 5000, previous: 15000};

    it('buffers and shows target when replayer is far from target', () => {
      const result = computeSeekBuffering(buffer, 15000, THRESHOLD);
      expect(result).toEqual({isBuffering: true, displayTime: 5000, hasPassed: false});
    });

    it('buffers and shows target when replayer is mid-seek', () => {
      const result = computeSeekBuffering(buffer, 10000, THRESHOLD);
      expect(result).toEqual({isBuffering: true, displayTime: 5000, hasPassed: false});
    });

    it('stops buffering but still shows target when replayer is within threshold', () => {
      const result = computeSeekBuffering(buffer, 5150, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 5000, hasPassed: false});
    });

    it('never shows a time after the target while replayer has not passed it', () => {
      for (const time of [15000, 10000, 7000, 5500, 5200, 5150, 5001]) {
        const result = computeSeekBuffering(buffer, time, THRESHOLD);
        expect(result.displayTime).toBeLessThanOrEqual(buffer.target);
      }
    });

    it('shows real time and signals clear when replayer reaches exact target', () => {
      const result = computeSeekBuffering(buffer, 5000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 5000, hasPassed: true});
    });

    it('shows real time and signals clear when replayer passes target', () => {
      const result = computeSeekBuffering(buffer, 4900, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 4900, hasPassed: true});
    });

    it('displayTime never increases as currentPlayerTime decreases', () => {
      const times = [15000, 12000, 8000, 5500, 5200, 5100, 5001, 5000, 4900, 4000];
      let prevDisplay = Infinity;
      for (const time of times) {
        const result = computeSeekBuffering(buffer, time, THRESHOLD);
        expect(result.displayTime).toBeLessThanOrEqual(prevDisplay);
        prevDisplay = result.displayTime;
      }
    });
  });

  describe('transition from buffering to cleared', () => {
    it('forward seek: no backward jump when buffer is cleared after hasPassed', () => {
      const buffer = {target: 15000, previous: 5000};

      const beforePass = computeSeekBuffering(buffer, 14900, THRESHOLD);
      expect(beforePass.displayTime).toBe(15000);
      expect(beforePass.hasPassed).toBe(false);

      const atPass = computeSeekBuffering(buffer, 15000, THRESHOLD);
      expect(atPass.displayTime).toBe(15000);
      expect(atPass.hasPassed).toBe(true);

      const afterClear = computeSeekBuffering(NO_SEEK, 15010, THRESHOLD);
      expect(afterClear.displayTime).toBe(15010);
      expect(afterClear.displayTime).toBeGreaterThanOrEqual(15000);
    });

    it('backward seek: no forward jump when buffer is cleared after hasPassed', () => {
      const buffer = {target: 5000, previous: 15000};

      const beforePass = computeSeekBuffering(buffer, 5100, THRESHOLD);
      expect(beforePass.displayTime).toBe(5000);
      expect(beforePass.hasPassed).toBe(false);

      const atPass = computeSeekBuffering(buffer, 5000, THRESHOLD);
      expect(atPass.displayTime).toBe(5000);
      expect(atPass.hasPassed).toBe(true);

      const afterClear = computeSeekBuffering(NO_SEEK, 4990, THRESHOLD);
      expect(afterClear.displayTime).toBe(4990);
      expect(afterClear.displayTime).toBeLessThanOrEqual(5000);
    });
  });

  describe('edge cases', () => {
    it('handles seek to time 0', () => {
      const buffer = {target: 0, previous: 5000};
      const result = computeSeekBuffering(buffer, 0, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 0, hasPassed: true});
    });

    it('handles very small forward seek within threshold', () => {
      const buffer = {target: 5100, previous: 5000};
      const result = computeSeekBuffering(buffer, 5000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 5100, hasPassed: false});
    });

    it('handles very small backward seek within threshold', () => {
      const buffer = {target: 4900, previous: 5000};
      const result = computeSeekBuffering(buffer, 5000, THRESHOLD);
      expect(result).toEqual({isBuffering: false, displayTime: 4900, hasPassed: false});
    });
  });
});
