import {z} from 'zod';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import type {TraceItemDataset} from 'sentry/views/explore/types';

const STALE_TIME = 5 * 60 * 1000;

const BaseValidationSchema = z.object({
  error: z.string().nullable(),
  valid: z.boolean(),
});

const BaseValidationReturnSchema = BaseValidationSchema.extend({
  attrType: z.string().nullish(),
  name: z.string().optional(),
});

export const EventValidationSchema = z.object({
  dataset: z.array(BaseValidationReturnSchema),
  environment: z.array(BaseValidationReturnSchema),
  field: z.array(BaseValidationReturnSchema),
  orderby: z.array(BaseValidationReturnSchema),
  projects: z.array(BaseValidationReturnSchema),
  query: z.array(BaseValidationReturnSchema),
  valid: z.boolean(),
});

export type EventValidationData = z.infer<typeof EventValidationSchema>;

type ValidateEventParamsOptions = {
  organization: Organization;
  selection: PageFilters;
  traceItemType: TraceItemDataset;
  environments?: string[];
  field?: string[];
  orderBy?: string[];
  projectIds?: Array<string | number>;
  projects?: Project[];
  query?: string;
};

export function validateEventParamsOptions({
  organization,
  selection,
  traceItemType,
  environments,
  field,
  orderBy,
  projectIds: explicitProjectIds,
  projects,
  query,
}: ValidateEventParamsOptions) {
  const projectIds =
    explicitProjectIds ??
    (defined(projects) ? projects.map(project => project.id) : selection.projects);

  return apiOptions.as<z.infer<typeof EventValidationSchema>>()(
    '/organizations/$organizationIdOrSlug/events/validate/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: STALE_TIME,
      query: {
        dataset: traceItemType,
        project: projectIds?.map(String),
        environment: environments ?? selection.environments,
        field,
        orderby: orderBy,
        query,
        ...normalizeDateTimeParams(selection.datetime),
      },
    }
  );
}
