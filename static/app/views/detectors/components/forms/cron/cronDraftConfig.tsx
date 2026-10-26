import moment from 'moment-timezone';
import {z} from 'zod';

import {
  draftNumber,
  draftOptionalNumber,
  type DetectorDraftConfig,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {CronDetectorFormData} from 'sentry/views/detectors/components/forms/cron/fields';
import {ScheduleType, type MonitorIntervalUnit} from 'sentry/views/insights/crons/types';
import {getScheduleIntervals} from 'sentry/views/insights/crons/utils';

const intervalUnits = new Set(getScheduleIntervals(1).map(({value}) => value));

export const CRON_DETECTOR_DRAFT_CONFIG: DetectorDraftConfig<CronDetectorFormData> = {
  shape: {
    checkinMargin: draftOptionalNumber,
    description: z.string().nullable(),
    failureIssueThreshold: draftNumber,
    maxRuntime: draftOptionalNumber,
    name: z.string(),
    owner: z.string(),
    projectId: z.string(),
    recoveryThreshold: draftNumber,
    scheduleCrontab: z.string(),
    scheduleIntervalUnit: z.custom<MonitorIntervalUnit>(
      value => typeof value === 'string' && intervalUnits.has(value)
    ),
    scheduleIntervalValue: draftNumber,
    scheduleType: z.enum(ScheduleType),
    timezone: z
      .string()
      .transform(value => moment.tz.zone(value)?.name)
      .refine(value => value !== undefined),
    workflowIds: z.array(z.string()),
  },
};
