import omit from 'lodash/omit';
import {z} from 'zod';

import {
  draftNumericString,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {PreprodDetectorFormData} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {
  ALL_MEASUREMENTS,
  ALL_METRIC_TYPES,
} from 'sentry/views/settings/project/preprod/types';

export const PREPROD_DETECTOR_DRAFT_SCHEMA: DetectorDraftSchema<PreprodDetectorFormData> =
  z
    .object({
      highThreshold: draftNumericString.optional().catch(undefined),
      lowThreshold: draftNumericString.optional().catch(undefined),
      measurement: z.enum(ALL_METRIC_TYPES).optional().catch(undefined),
      name: z.string().optional().catch(undefined),
      owner: z.string().optional().catch(undefined),
      projectId: z.string().optional().catch(undefined),
      query: z.string().optional().catch(undefined),
      thresholdType: z.enum(ALL_MEASUREMENTS).optional().catch(undefined),
      workflowIds: z.array(z.string()).optional().catch(undefined),
    })
    // Thresholds are in MB or percent depending on the threshold type.
    .transform(values =>
      values.thresholdType === undefined
        ? omit(values, ['highThreshold', 'lowThreshold'])
        : values
    );
