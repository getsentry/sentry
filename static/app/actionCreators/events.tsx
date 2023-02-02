import {UseMutationOptions, useQueryClient} from '@tanstack/react-query';
import {LocationDescriptor} from 'history';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client, ResponseMeta} from 'sentry/api';
import {canIncludePreviousPeriod} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {
  DateString,
  EventsStats,
  IssueAttachment,
  MultiSeriesEventsStats,
  OrganizationSummary,
} from 'sentry/types';
import {LocationQuery} from 'sentry/utils/discover/eventView';
import {getPeriod} from 'sentry/utils/getPeriod';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import {QueryBatching} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {QueryKey, useMutation, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type Options = {
  organization: OrganizationSummary;
  partial: boolean;
  comparisonDelta?: number;
  end?: DateString;
  environment?: Readonly<string[]>;
  excludeOther?: boolean;
  field?: string[];
  generatePathname?: (org: OrganizationSummary) => string;
  includePrevious?: boolean;
  interval?: string;
  limit?: number;
  orderby?: string;
  period?: string | null;
  project?: Readonly<number[]>;
  query?: string;
  queryBatching?: QueryBatching;
  queryExtras?: Record<string, string>;
  referrer?: string;
  start?: DateString;
  team?: Readonly<string | string[]>;
  topEvents?: number;
  withoutZerofill?: boolean;
  yAxis?: string | string[];
};

/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {Boolean} options.excludeOther Exclude the "Other" series when making a topEvents query
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 * @param {QueryBatching} options.queryBatching A container for batching functions from a provider
 * @param {Record<string, string>} options.queryExtras A list of extra query parameters
 * @param {(org: OrganizationSummary) => string} options.generatePathname A function that returns an override for the pathname
 */
export const doEventsRequest = <IncludeAllArgsType extends boolean = false>(
  api: Client,
  {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
    queryBatching,
    generatePathname,
    queryExtras,
    excludeOther,
    includeAllArgs,
  }: {includeAllArgs?: IncludeAllArgsType} & Options
): IncludeAllArgsType extends true
  ? Promise<
      [EventsStats | MultiSeriesEventsStats, string | undefined, ResponseMeta | undefined]
    >
  : Promise<EventsStats | MultiSeriesEventsStats> => {
  const pathname =
    generatePathname?.(organization) ??
    `/organizations/${organization.slug}/events-stats/`;

  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = Object.fromEntries(
    Object.entries({
      interval,
      comparisonDelta,
      project,
      environment,
      team,
      query,
      yAxis,
      field,
      topEvents,
      orderby,
      partial: partial ? '1' : undefined,
      withoutZerofill: withoutZerofill ? '1' : undefined,
      referrer: referrer ? referrer : 'api.organization-event-stats',
      excludeOther: excludeOther ? '1' : undefined,
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  const queryObject = {
    includeAllArgs,
    query: {
      ...urlQuery,
      ...periodObj,
      ...queryExtras,
    },
  };

  if (queryBatching?.batchRequest) {
    return queryBatching.batchRequest(api, pathname, queryObject);
  }

  return api.requestPromise<IncludeAllArgsType>(pathname, queryObject);
};

export type EventQuery = {
  field: string[];
  query: string;
  environment?: string[];
  equation?: string[];
  noPagination?: boolean;
  per_page?: number;
  project?: string | string[];
  referrer?: string;
  sort?: string | string[];
  team?: string | string[];
};

export type TagSegment = {
  count: number;
  name: string;
  url: LocationDescriptor;
  value: string;
  isOther?: boolean;
  key?: string;
};

export type Tag = {
  key: string;
  topValues: Array<TagSegment>;
};

/**
 * Fetches tag facets for a query
 */
export function fetchTagFacets(
  api: Client,
  orgSlug: string,
  query: EventQuery
): Promise<Tag[]> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption,
  });
}

/**
 * Fetches total count of events for a given query
 */
export function fetchTotalCount(
  api: Client,
  orgSlug: string,
  query: EventQuery & LocationQuery
): Promise<number> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  type Response = {
    count: number;
  };

  return api
    .requestPromise(`/organizations/${orgSlug}/events-meta/`, {
      query: queryOption,
    })
    .then((res: Response) => res.count);
}

type FetchEventAttachmentParameters = {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
};

type FetchEventAttachmentResponse = IssueAttachment[];

export const makeFetchEventAttachmentsQueryKey = ({
  orgSlug,
  projectSlug,
  eventId,
}: FetchEventAttachmentParameters): QueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/attachments/`,
];

export const useFetchEventAttachments = (
  {orgSlug, projectSlug, eventId}: FetchEventAttachmentParameters,
  options: Partial<UseQueryOptions<FetchEventAttachmentResponse>> = {}
) => {
  const organization = useOrganization();
  return useQuery<FetchEventAttachmentResponse>(
    [`/projects/${orgSlug}/${projectSlug}/events/${eventId}/attachments/`],
    {
      staleTime: Infinity,
      ...options,
      enabled:
        (organization.features?.includes('event-attachments') ?? false) &&
        options.enabled !== false,
    }
  );
};

type DeleteEventAttachmentVariables = {
  attachmentId: string;
  eventId: string;
  orgSlug: string;
  projectSlug: string;
};

type DeleteEventAttachmentResponse = unknown;

type DeleteEventAttachmentContext = {
  previous?: IssueAttachment[];
};

type DeleteEventAttachmentOptions = UseMutationOptions<
  DeleteEventAttachmentResponse,
  RequestError,
  DeleteEventAttachmentVariables,
  DeleteEventAttachmentContext
>;

export const useDeleteEventAttachmentOptimistic = (
  incomingOptions: Partial<DeleteEventAttachmentOptions> = {}
) => {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const options: DeleteEventAttachmentOptions = {
    ...incomingOptions,
    mutationFn: ({orgSlug, projectSlug, eventId, attachmentId}) => {
      return api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/events/${eventId}/attachments/${attachmentId}/`,
        {method: 'DELETE'}
      );
    },
    onMutate: async variables => {
      await queryClient.cancelQueries(makeFetchEventAttachmentsQueryKey(variables));

      const previous = queryClient.getQueryData<FetchEventAttachmentResponse>(
        makeFetchEventAttachmentsQueryKey(variables)
      );

      queryClient.setQueryData<FetchEventAttachmentResponse>(
        makeFetchEventAttachmentsQueryKey(variables),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(attachment => attachment?.id !== variables.attachmentId);
        }
      );

      incomingOptions.onMutate?.(variables);

      return {previous};
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('An error occurred while deleting the attachment'));

      if (context) {
        queryClient.setQueryData(
          makeFetchEventAttachmentsQueryKey(variables),
          context.previous
        );
      }

      incomingOptions.onError?.(error, variables, context);
    },
  };

  return useMutation(options);
};
