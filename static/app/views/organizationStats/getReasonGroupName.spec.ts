import {Outcome} from 'sentry/types/core';

import {ClientDiscardReason, getReasonGroupName} from './getReasonGroupName';

describe('getReasonGroupName', function () {
  it('handles legacy too_large reason', function () {
    expect(getReasonGroupName(Outcome.INVALID, 'too_large')).toBe('too_large');
  });

  it('handles all edge cases for reasons', function () {
    const testCases: Array<[string, string]> = [
      ['too_large:unknown', 'too_large'],
      ['too_large', 'too_large'],
      ['too_large:attachment', 'too_large_attachment'],
      ['too_large:strange:reason', 'too_large_strange:reason'],
      ['to_large:raw_security', 'internal'],
      [':attachment', 'internal'],
      ['', 'internal'],
      ['too_large:future_reason', 'too_large_future_reason'],
    ];

    testCases.forEach(([input, expected]) => {
      expect(getReasonGroupName(Outcome.INVALID, input)).toBe(expected);
    });
  });

  it('handles other existing reason types', function () {
    expect(getReasonGroupName(Outcome.INVALID, 'duplicate')).toBe('duplicate');
    expect(getReasonGroupName(Outcome.INVALID, 'duplicate_item')).toBe('invalid_request');
    expect(getReasonGroupName(Outcome.INVALID, 'project_id')).toBe('project_missing');
    expect(getReasonGroupName(Outcome.INVALID, 'invalid_transaction')).toBe(
      'invalid_data'
    );

    expect(getReasonGroupName(Outcome.RATE_LIMITED, 'key_quota')).toBe('DSN limit');
    expect(getReasonGroupName(Outcome.RATE_LIMITED, 'org_quota')).toBe('global limit');

    expect(getReasonGroupName(Outcome.FILTERED, 'browser-extensions')).toBe(
      'Browser Extensions'
    );

    expect(getReasonGroupName(Outcome.CLIENT_DISCARD, 'queue_overflow')).toBe(
      ClientDiscardReason.QUEUE_OVERFLOW
    );
  });
});
