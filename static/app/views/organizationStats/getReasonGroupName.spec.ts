import {Outcome} from 'sentry/types/core';

import {ClientDiscardReason, getReasonGroupName} from './getReasonGroupName';

describe('getReasonGroupName', function () {
  it('handles legacy too_large reason', function () {
    expect(getReasonGroupName(Outcome.INVALID, 'too_large')).toBe('too_large_other');
  });

  it('handles all new (visible) discard reasons', function () {
    const testCases: Array<[string, string]> = [
      ['too_large:unknown', 'too_large_other'],
      ['too_large:security', 'too_large_other'],
      ['too_large:raw_security', 'too_large_other'],
      ['too_large:statsd', 'too_large_other'],
      ['too_large:metric_buckets', 'too_large_other'],
      ['too_large:client_report', 'too_large_other'],
      ['too_large:check_in', 'too_large_other'],
      ['too_large:otel_traces_data', 'too_large_other'],

      ['too_large:event', 'too_large_event'],
      ['too_large:transaction', 'too_large_transaction'],
      ['too_large:attachment', 'too_large_attachment'],
      ['too_large:form_data', 'too_large_form_data'],
      ['too_large:nel', 'too_large_nel'],
      ['too_large:unreal_report', 'too_large_unreal_report'],
      ['too_large:user_report', 'too_large_user_report'],
      ['too_large:user_report_v2', 'too_large_user_report'],
      ['too_large:session', 'too_large_session'],
      ['too_large:sessions', 'too_large_session'],
      ['too_large:profile', 'too_large_profile'],
      ['too_large:replay_event', 'too_large_replay'],
      ['too_large:replay_recording', 'too_large_replay'],
      ['too_large:replay_video', 'too_large_replay'],
      ['too_large:otel_log', 'too_large_log'],
      ['too_large:log', 'too_large_log'],
      ['too_large:span', 'too_large_span'],
      ['too_large:otel_span', 'too_large_span'],
      ['too_large:profile_chunk', 'too_large_profile'],
    ];

    testCases.forEach(([input, expected]) => {
      expect(getReasonGroupName(Outcome.INVALID, input)).toBe(expected);
    });
  });

  it('handles all edge cases for reasons', function () {
    const testCases: Array<[string, string]> = [
      ['too_large:invalid', 'too_large_other'],
      ['too_large:strange:reason', 'too_large_other'],
      ['to_large:raw_security', 'internal'],
      [':attachment', 'internal'],
      ['', 'internal'],
      ['too_large:future_reason', 'too_large_other'],
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
