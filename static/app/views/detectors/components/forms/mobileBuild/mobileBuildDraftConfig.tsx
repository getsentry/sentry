import omit from 'lodash/omit';
import {z} from 'zod';

import {
  draftDescription,
  draftField,
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
      description: draftField(draftDescription),
      highThreshold: draftField(draftNumericString),
      lowThreshold: draftField(draftNumericString),
      measurement: draftField(z.enum(ALL_METRIC_TYPES)),
      name: draftField(z.string()),
      owner: draftField(z.string()),
      projectId: draftField(z.string()),
      query: draftField(z.string()),
      thresholdType: draftField(z.enum(ALL_MEASUREMENTS)),
      workflowIds: draftField(z.array(z.string())),
    })
    // Thresholds are in MB or percent depending on the threshold type.
    .transform(values =>
      values.thresholdType === undefined
        ? omit(values, ['highThreshold', 'lowThreshold'])
        : values
    );
