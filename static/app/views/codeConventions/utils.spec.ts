import {getConventionScanUsage} from 'sentry/views/codeConventions/utils';

describe('getConventionScanUsage', () => {
  it('prices prefilter scans at Haiku input rates', () => {
    expect(
      getConventionScanUsage({name: 'no-class-components', prefilter: 'grep x .'})
    ).toEqual({tokens: 226_663, costUsd: 0.226663});
  });

  it('is free for detect_command conventions', () => {
    expect(
      getConventionScanUsage({name: 'no-deprecated-callsite', detect_command: 'bash x'})
    ).toEqual({tokens: 0, costUsd: 0});
  });

  it('has no estimate for unknown conventions', () => {
    expect(getConventionScanUsage({name: 'brand-new', prefilter: 'grep x .'})).toBeNull();
  });
});
