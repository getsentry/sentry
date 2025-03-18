import {Outcome} from 'sentry/types/core';

import {ClientDiscardReason, getReasonGroupName} from './getReasonGroupName';

describe('getReasonGroupName', function () {
  it('handles legacy too_large reason', function () {
    expect(getReasonGroupName(Outcome.INVALID, 'too_large')).toBe('too_large');
  });

  // We apply the following to all the reasons: startCase(reason.replace(/-|_/g, ' '))
  // Which will convert: 'too_large_attachment' -> 'Too Large Attachment'
  it('handles all new too_large reasons', function () {
    const testCases: Array<[string, string]> = [
      ['too_large:unknown', 'too_large'],
      ['too_large:event', 'too_large_event'],
      ['too_large:transaction', 'too_large_transaction'],
      ['too_large:security', 'too_large_security'],
      ['too_large:attachment', 'too_large_attachment'],
      ['too_large:form_data', 'too_large_form_data'],
      ['too_large:raw_security', 'too_large_raw_security'],
      ['too_large:nel', 'too_large_nel'],
      ['too_large:unreal_report', 'too_large_unreal_report'],
      ['too_large:user_report', 'too_large_user_report'],
      ['too_large:session', 'too_large_session'],
      ['too_large:sessions', 'too_large_sessions'],
      ['too_large:statsd', 'too_large_statsd'],
      ['too_large:metric_buckets', 'too_large_metric_buckets'],
      ['too_large:client_report', 'too_large_client_report'],
      ['too_large:profile', 'too_large_profile'],
      ['too_large:replay_event', 'too_large_replay_event'],
      ['too_large:replay_recording', 'too_large_replay_recording'],
      ['too_large:replay_video', 'too_large_replay_video'],
      ['too_large:check_in', 'too_large_check_in'],
      ['too_large:otel_log', 'too_large_otel_log'],
      ['too_large:log', 'too_large_log'],
      ['too_large:span', 'too_large_span'],
      ['too_large:otel_span', 'too_large_otel_span'],
      ['too_large:otel_traces_data', 'too_large_otel_traces_data'],
      ['too_large:user_report_v2', 'too_large_user_report_v2'],
      ['too_large:profile_chunk', 'too_large_profile_chunk'],
    ];

    testCases.forEach(([input, expected]) => {
      expect(getReasonGroupName(Outcome.INVALID, input)).toBe(expected);
    });
  });

  it('handles unknown too_large reasons', function () {
    // Make sure that future too large types are still being displayed correctly
    // That is, if someone adds a new item type in Relay they do not need to update
    // the front-end.
    expect(getReasonGroupName(Outcome.INVALID, 'too_large:future_type')).toBe(
      'too_large_future_type'
    );
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
