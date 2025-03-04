// import {defined} from 'sentry/utils';
// import {
//   type ApiQueryKey,
//   useApiQuery,
//   type UseApiQueryOptions,
// } from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';
// import type type type type { GroupTag } from 'sentry/views/issueDetails/groupTags/useGroupTags';
// import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

// interface FetchIssueTagsParameters {
//   environment: string[] | string | undefined;
//   /**
//    * Request is disabled until groupId is defined
//    */
//   groupId: string | undefined;
//   orgSlug: string;
//   limit?: number;
//   /**
//    * Readable formats mobile device names
//    * TODO(scott): Can we do this in the frontend instead
//    */
//   readable?: boolean;
// }

// type GroupTagUseQueryOptions = Partial<UseApiQueryOptions<GroupTag[]>>;

// const makeGroupFlagsQueryKey = ({
//   groupId,
//   orgSlug,
//   environment,
//   readable,
//   limit,
// }: FetchIssueTagsParameters): ApiQueryKey => [
//   `/organizations/${orgSlug}/issues/${groupId}/tags/`,
//   {query: {environment, readable, limit, useFlagsBackend: '1'}},
// ];

// export function useGroupTags(
//   parameters: Omit<FetchIssueTagsParameters, 'orgSlug'>,
//   {enabled = true, ...options}: GroupTagUseQueryOptions = {}
// ) {
//   const organization = useOrganization();
//   return useApiQuery<GroupTag[]>(
//     makeGroupFlagsQueryKey({
//       orgSlug: organization.slug,
//       ...parameters,
//     }),
//     {
//       staleTime: 30000,
//       enabled: defined(parameters.groupId) && enabled,
//       ...options,
//     }
//   );
// }

// /**
//  * Primarily used for tag facets
//  */
// export function useGroupTagsReadable(
//   parameters: Omit<FetchIssueTagsParameters, 'orgSlug' | 'limit' | 'readable'>,
//   options: GroupTagUseQueryOptions = {}
// ) {
//   const hasStreamlinedUI = useHasStreamlinedUI();
//   return useGroupTags(
//     {
//       readable: true,
//       limit: hasStreamlinedUI ? 3 : 4,
//       ...parameters,
//     },
//     options
//   );
// }
