import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

export function LogFixture({
  [OurLogKnownFieldKey.PROJECT_ID]: projectId,
  [OurLogKnownFieldKey.ORGANIZATION_ID]: organizationId,
  [OurLogKnownFieldKey.ID]: id,
  [OurLogKnownFieldKey.MESSAGE]: message = 'test log body',
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: severityNumber = 456,
  [OurLogKnownFieldKey.SEVERITY]: severity = 'error',
  [OurLogKnownFieldKey.TIMESTAMP]: timestamp = '2025-04-03T15:50:10+00:00',
  [OurLogKnownFieldKey.TRACE_ID]: traceId = '7b91699fd385d9fd52e0c4bc',
  [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise = 1.744312870049196e18,
  ...rest
}: Partial<OurLogsResponseItem>): OurLogsResponseItem {
  return {
    [OurLogKnownFieldKey.ID]: String(id),
    [OurLogKnownFieldKey.PROJECT_ID]: String(projectId),
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organizationId),
    [OurLogKnownFieldKey.MESSAGE]: message,
    [OurLogKnownFieldKey.SEVERITY_NUMBER]: severityNumber,
    [OurLogKnownFieldKey.SEVERITY]: severity,
    [OurLogKnownFieldKey.TIMESTAMP]: timestamp,
    [OurLogKnownFieldKey.TRACE_ID]: traceId,
    [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: timestampPrecise,
    ...rest,
  };
}
