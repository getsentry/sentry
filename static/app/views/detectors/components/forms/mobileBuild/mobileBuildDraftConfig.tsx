import omit from 'lodash/omit';
import {z} from 'zod';

import {
  draftNumericString,
  type DetectorDraftConfig,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {PreprodDetectorFormData} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {
  ALL_MEASUREMENTS,
  ALL_METRIC_TYPES,
} from 'sentry/views/settings/project/preprod/types';

export const PREPROD_DETECTOR_DRAFT_CONFIG: DetectorDraftConfig<PreprodDetectorFormData> =
  {
    shape: {
      description: z.string().nullable(),
      highThreshold: draftNumericString,
      lowThreshold: draftNumericString,
      measurement: z.enum(ALL_METRIC_TYPES),
      name: z.string(),
      owner: z.string(),
      projectId: z.string(),
      query: z.string(),
      thresholdType: z.enum(ALL_MEASUREMENTS),
      workflowIds: z.array(z.string()),
    },
    // Thresholds are in MB or percent depending on the threshold type.
    normalize: values =>
      values.thresholdType === undefined
        ? omit(values, ['highThreshold', 'lowThreshold'])
        : values,
  };
