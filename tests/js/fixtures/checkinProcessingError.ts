import { CheckinProcessingError } from "sentry/views/monitors/types";

export function CheckinProcessingErrorFixture(
  params: Partial<CheckinProcessingError> = {}
): CheckinProcessingError {
  return {
    id: '',
    checkin: {
      message: {
        message_type: 'check_in',
        payload: '',
        project_id: 1,
        retention_days: 90,
        sdk: '',
        start_time: 171659668,
        type: 'check_in',
      },
      partition: 0,
      payload: {
        check_in_id: '',
        environment: 'prod',
        monitor_slug: '',
        status: 'ok',
      },
      ts: '2024-05-25T00:24:29.739000',
    },
    errors: [{type: 1}],
    ...params,
  };
}
