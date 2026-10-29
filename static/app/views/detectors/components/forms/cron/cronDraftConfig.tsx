import moment from 'moment-timezone';
import {z} from 'zod';

import {
  draftDescription,
  draftField,
  draftNumber,
  draftOptionalNumber,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {CronDetectorFormData} from 'sentry/views/detectors/components/forms/cron/fields';
import {ScheduleType, type MonitorIntervalUnit} from 'sentry/views/insights/crons/types';
import {getScheduleIntervals} from 'sentry/views/insights/crons/utils';

const intervalUnits = new Set(getScheduleIntervals(1).map(({value}) => value));

export const CRON_DETECTOR_DRAFT_SCHEMA: DetectorDraftSchema<CronDetectorFormData> =
  z.object({
    checkinMargin: draftField(draftOptionalNumber),
    description: draftField(draftDescription),
    failureIssueThreshold: draftField(draftNumber),
    maxRuntime: draftField(draftOptionalNumber),
    name: draftField(z.string()),
    owner: draftField(z.string()),
    projectId: draftField(z.string()),
    recoveryThreshold: draftField(draftNumber),
    scheduleCrontab: draftField(z.string()),
    scheduleIntervalUnit: draftField(
      z.custom<MonitorIntervalUnit>(
        value => typeof value === 'string' && intervalUnits.has(value)
      )
    ),
    scheduleIntervalValue: draftField(draftNumber),
    scheduleType: draftField(z.enum(ScheduleType)),
    timezone: draftField(
      z
        .string()
        .transform(value => moment.tz.zone(value)?.name)
        .refine(value => value !== undefined)
    ),
    workflowIds: draftField(z.array(z.string())),
  });
