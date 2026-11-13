import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import {defined} from 'sentry/utils/defined';
import type {LinkedDashboard} from 'sentry/views/dashboards/types';

const linkedDashboardSchema = z.object({
  dashboardId: z.union([z.string(), z.number()]).refine(Boolean).transform(String),
  field: z.string().min(1),
});

const parseAsLinkedDashboard = parseAsJson(
  value => linkedDashboardSchema.safeParse(value).data ?? null
);

export function deserializeLinkedDashboards(
  values: readonly string[]
): LinkedDashboard[] {
  return values.map(value => parseAsLinkedDashboard.parse(value)).filter(defined);
}
