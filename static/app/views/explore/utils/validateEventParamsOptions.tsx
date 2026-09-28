import {keepPreviousData, queryOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {TraceItemDataset} from 'sentry/views/explore/types';

const STALE_TIME = 5 * 60 * 1000;

// These schemas mirror the response dataclasses in
// src/sentry/api/endpoints/organization_events_validate.py
// Matches Validation
const ValidationSchema = z.object({
  error: z.string().nullable(),
  valid: z.boolean(),
});

// Mirrors NamedValidation
const NamedValidationSchema = z.object({
  error: z.string().nullable(),
  name: z.string(),
  valid: z.boolean(),
});

// Mirrors AttributeValidation
const AttributeValidationSchema = z.object({
  attrType: z.string().nullable(),
  error: z.string().nullable(),
  name: z.string(),
  valid: z.boolean(),
});

// Mirrors QueryValidation
const QueryValidationSchema = z.object({
  error: z.string().nullable(),
  fields: z.array(AttributeValidationSchema),
  valid: z.boolean(),
});

const EventValidationSchema = z.object({
  dataset: z.array(NamedValidationSchema),
  environment: z.array(ValidationSchema),
  field: z.array(AttributeValidationSchema),
  orderby: z.array(AttributeValidationSchema),
  projects: z.array(ValidationSchema),
  query: QueryValidationSchema,
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

  const baseOptions = apiOptions.as<z.infer<typeof EventValidationSchema>>()(
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

  const originalQueryFn = baseOptions.queryFn;

  if (typeof originalQueryFn !== 'function') {
    return queryOptions({
      ...baseOptions,
      placeholderData: keepPreviousData,
    });
  }

  return queryOptions({
    ...baseOptions,
    queryFn: async context => {
      try {
        return await originalQueryFn(context);
      } catch (error) {
        if (error instanceof RequestError) {
          const parsedData = EventValidationSchema.safeParse(error.responseJSON ?? {});
          if (parsedData.success) {
            return {headers: {}, json: parsedData.data};
          }
        }
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });
}
