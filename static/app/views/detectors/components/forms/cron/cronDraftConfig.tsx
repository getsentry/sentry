import moment from 'moment-timezone';
import {z} from 'zod';

import {
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
    checkinMargin: draftOptionalNumber.optional().catch(undefined),
    failureIssueThreshold: draftNumber.optional().catch(undefined),
    maxRuntime: draftOptionalNumber.optional().catch(undefined),
    name: z.string().optional().catch(undefined),
    owner: z.string().optional().catch(undefined),
    projectId: z.string().optional().catch(undefined),
    recoveryThreshold: draftNumber.optional().catch(undefined),
    scheduleCrontab: z.string().optional().catch(undefined),
    scheduleIntervalUnit: z
      .custom<MonitorIntervalUnit>(
        value => typeof value === 'string' && intervalUnits.has(value)
      )
      .optional()
      .catch(undefined),
    scheduleIntervalValue: draftNumber.optional().catch(undefined),
    scheduleType: z.enum(ScheduleType).optional().catch(undefined),
    timezone: z
      .string()
      .transform(value => moment.tz.zone(value)?.name)
      .refine(value => value !== undefined)
      .optional()
      .catch(undefined),
    workflowIds: z.array(z.string()).optional().catch(undefined),
  });
