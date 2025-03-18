import {Outcome} from 'sentry/types/core';

import {ClientDiscardReason, getReasonGroupName} from './getReasonGroupName';

describe('getReasonGroupName', function () {
  it('handles legacy too_large reason', function () {
    expect(getReasonGroupName(Outcome.INVALID, 'too_large')).toBe('too_large');
  });

  // We apply the following to all the reasons: startCase(reason.replace(/-|_/g, ' '))
  // Which will convert: 'too_large:_attachment' -> 'Too Large: Attachment'
  it('handles all new too_large reasons', function () {
    const testCases: Array<[string, string]> = [
      ['too_large:unknown', 'too_large'],
      ['too_large:event', 'too_large:_event'],
      ['too_large:transaction', 'too_large:_transaction'],
      ['too_large:security', 'too_large:_security'],
      ['too_large:attachment', 'too_large:_attachment'],
      ['too_large:form_data', 'too_large:_form_data'],
      ['too_large:raw_security', 'too_large:_raw_security'],
      ['too_large:nel', 'too_large:_nel'],
      ['too_large:unreal_report', 'too_large:_unreal_report'],
      ['too_large:user_report', 'too_large:_user_report'],
      ['too_large:session', 'too_large:_session'],
      ['too_large:sessions', 'too_large:_sessions'],
      ['too_large:statsd', 'too_large:_statsd'],
      ['too_large:metric_buckets', 'too_large:_metric_buckets'],
      ['too_large:client_report', 'too_large:_client_report'],
      ['too_large:profile', 'too_large:_profile'],
      ['too_large:replay_event', 'too_large:_replay_event'],
      ['too_large:replay_recording', 'too_large:_replay_recording'],
      ['too_large:replay_video', 'too_large:_replay_video'],
      ['too_large:check_in', 'too_large:_check_in'],
      ['too_large:otel_log', 'too_large:_otel_log'],
      ['too_large:log', 'too_large:_log'],
      ['too_large:span', 'too_large:_span'],
      ['too_large:otel_span', 'too_large:_otel_span'],
      ['too_large:otel_traces_data', 'too_large:_otel_traces_data'],
      ['too_large:user_report_v2', 'too_large:_user_report_v2'],
      ['too_large:profile_chunk', 'too_large:_profile_chunk'],
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
      'too_large:_future_type'
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
