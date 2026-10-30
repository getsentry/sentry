import {
  queryOptions,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {z} from 'zod';

import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {
  InvestigationActionRequest,
  InvestigationActionRequestApplyResponse,
  InvestigationCandidate,
  InvestigationBlock,
  InvestigationComment,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationListItem,
  InvestigationOrchestration,
  InvestigationTitleGeneration,
  InvestigationViewer,
  ManualInvestigationSource,
  MetricOpenPeriodInvestigationSource,
} from 'sentry/views/investigations/types';

type ListOptions = {
  organizationSlug: string;
  cursor?: string;
  query?: string;
};

export function investigationListQueryOptions({
  organizationSlug,
  cursor,
  query,
}: ListOptions) {
  return apiOptions.as<InvestigationListItem[]>()(
    '/organizations/$organizationIdOrSlug/investigations/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {status: 'active', cursor, query},
      staleTime: 0,
    }
  );
}

export function getInvestigationDetailQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationDetail>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        investigationId,
      },
      staleTime: 30_000,
    }
  );
}

export const INVESTIGATION_COMMENTS_PAGE_SIZE = 100;

/** Newest first. Without `blockId`, page-level and block comments together. */
export function investigationCommentsQueryOptions({
  organizationSlug,
  investigationId,
  blockId,
}: {
  investigationId: string;
  organizationSlug: string;
  blockId?: string;
}) {
  return apiOptions.as<InvestigationComment[]>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/comments/',
    {
      path: {organizationIdOrSlug: organizationSlug, investigationId},
      query: {blockId, per_page: INVESTIGATION_COMMENTS_PAGE_SIZE},
      staleTime: 0,
    }
  );
}

/** Page-level comment, or a block comment when `blockId` is set. */
export function useCreateInvestigationCommentMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<InvestigationComment, {body: string; blockId?: string}>
) {
  const [commentsUrl] = investigationCommentsQueryOptions({
    organizationSlug,
    investigationId,
  }).queryKey;
  const invalidateComments = useInvalidateInvestigationComments(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({body, blockId}) =>
      fetchMutation<InvestigationComment>({
        url: commentsUrl,
        method: 'POST',
        data: blockId === undefined ? {body} : {body, blockId},
      }),
    onSuccess: async (comment, variables, onMutateResult, context) => {
      await invalidateComments();
      await options?.onSuccess?.(comment, variables, onMutateResult, context);
    },
  });
}

function investigationCommentUrl(
  organizationSlug: string,
  investigationId: string,
  commentId: string
) {
  return getApiUrl(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/comments/$commentId/',
    {path: {organizationIdOrSlug: organizationSlug, investigationId, commentId}}
  );
}

function useInvalidateInvestigationComments(
  organizationSlug: string,
  investigationId: string
) {
  const queryClient = useQueryClient();
  const [commentsUrl] = investigationCommentsQueryOptions({
    organizationSlug,
    investigationId,
  }).queryKey;
  return () =>
    Promise.all([
      queryClient.invalidateQueries({queryKey: [commentsUrl]}),
      queryClient.invalidateQueries({
        queryKey: investigationCommentCountsQueryOptions(
          organizationSlug,
          investigationId
        ).queryKey,
      }),
    ]);
}

export function useUpdateInvestigationCommentMutation(
  organizationSlug: string,
  investigationId: string
) {
  const queryClient = useQueryClient();
  const [commentsUrl] = investigationCommentsQueryOptions({
    organizationSlug,
    investigationId,
  }).queryKey;
  const invalidateComments = useInvalidateInvestigationComments(
    organizationSlug,
    investigationId
  );

  return useMutation({
    mutationFn: ({commentId, body}: {body: string; commentId: string}) =>
      fetchMutation<InvestigationComment>({
        url: investigationCommentUrl(organizationSlug, investigationId, commentId),
        method: 'PUT',
        data: {body},
      }),
    onSuccess: updated => {
      queryClient.setQueriesData(
        {queryKey: [commentsUrl]},
        (prev: ApiResponse<InvestigationComment[]> | undefined) =>
          prev && {
            ...prev,
            json: prev.json.map(comment =>
              comment.id === updated.id ? updated : comment
            ),
          }
      );
    },
    onSettled: invalidateComments,
  });
}

export function useDeleteInvestigationCommentMutation(
  organizationSlug: string,
  investigationId: string
) {
  const queryClient = useQueryClient();
  const [commentsUrl] = investigationCommentsQueryOptions({
    organizationSlug,
    investigationId,
  }).queryKey;
  const invalidateComments = useInvalidateInvestigationComments(
    organizationSlug,
    investigationId
  );

  return useMutation({
    mutationFn: ({commentId}: {commentId: string}) =>
      fetchMutation<void>({
        url: investigationCommentUrl(organizationSlug, investigationId, commentId),
        method: 'DELETE',
      }),
    onSuccess: (_data, {commentId}) => {
      queryClient.setQueriesData(
        {queryKey: [commentsUrl]},
        (prev: ApiResponse<InvestigationComment[]> | undefined) =>
          prev && {...prev, json: prev.json.filter(comment => comment.id !== commentId)}
      );
    },
    onSettled: invalidateComments,
  });
}

/** Comment count per block, for blocks that have comments. */
export function investigationCommentCountsQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<Record<string, number>>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/comment-counts/',
    {
      path: {organizationIdOrSlug: organizationSlug, investigationId},
      staleTime: 0,
    }
  );
}

export function investigationExecutionDetailQueryOptions({
  organizationSlug,
  investigationId,
  blockId,
  executionId,
}: {
  blockId: string;
  executionId: string;
  investigationId: string;
  organizationSlug: string;
}) {
  return apiOptions.as<InvestigationExecutionDetail>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/$blockId/executions/$executionId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        investigationId,
        blockId,
        executionId,
      },
      staleTime: 0,
    }
  );
}

export function investigationTitleGenerationQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationTitleGeneration>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/title-generation/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        investigationId,
      },
      staleTime: 0,
    }
  );
}

/**
 * Records a presence heartbeat and returns the other viewers, active ones first,
 * up to `limit`. `total` counts all of them.
 */
export function investigationPresenceQueryOptions(
  organizationSlug: string,
  investigationId: string,
  limit: number
) {
  return apiOptions.as<{
    heartbeatIntervalMs: number;
    total: number;
    viewers: InvestigationViewer[];
  }>()('/organizations/$organizationIdOrSlug/investigations/$investigationId/presence/', {
    path: {
      organizationIdOrSlug: organizationSlug,
      investigationId,
    },
    query: {limit},
    method: 'PUT',
    staleTime: 0,
  });
}

/**
 * The live state of an agentic run: phase, broad scan, hypotheses, and report
 * progress. Seer overwrites the whole projection on every orchestration event,
 * so there is nothing to merge — the newest response wins outright.
 *
 * `staleTime: 0` because a running workflow changes constantly. Callers that
 * render a run in progress should add a `refetchInterval` and drop it once
 * `status` reaches a terminal value, as `InvestigationHypotheses` does.
 */
export function investigationOrchestrationQueryOptions(
  organizationSlug: string,
  investigationId: string
) {
  return apiOptions.as<InvestigationOrchestration>()(
    '/organizations/$organizationIdOrSlug/investigations/$investigationId/orchestration/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        investigationId,
      },
      staleTime: 0,
    }
  );
}

export function investigationCandidatesQueryOptions({
  organizationSlug,
  sources,
}: {
  organizationSlug: string;
  sources: MetricOpenPeriodInvestigationSource[];
}) {
  return apiOptions.as<{items: InvestigationCandidate[]}>()(
    '/organizations/$organizationIdOrSlug/investigations/candidates/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      method: 'POST',
      data: {sources},
      staleTime: 30_000,
    }
  );
}

function investigationCandidatesUrl(organizationSlug: string) {
  const [url] = investigationCandidatesQueryOptions({
    organizationSlug,
    sources: [],
  }).queryKey;
  return url;
}

type FavoriteVariables = {
  investigation: InvestigationListItem;
  shouldFavorite: boolean;
};

type DeleteBlockVariables = {
  block: InvestigationBlock;
  investigationVersion: number;
};

type StopExecutionVariables = {
  blockId: string;
  executionId: string;
};

type ResumeExecutionVariables = StopExecutionVariables & {
  inputId: string;
  responseData: {answers: string[]};
};

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  'mutationFn'
>;

function useInvestigationMutation<TData, TVariables>(
  organizationSlug: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: MutationOptions<TData, TVariables>,
  {invalidateCandidates = false}: {invalidateCandidates?: boolean} = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: investigationListQueryOptions({organizationSlug}).queryKey,
        }),
        invalidateCandidates
          ? queryClient.invalidateQueries({
              queryKey: [investigationCandidatesUrl(organizationSlug)],
            })
          : Promise.resolve(),
      ]);
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useLaunchInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationDetail, MetricOpenPeriodInvestigationSource>
) {
  return useInvestigationMutation(
    organizationSlug,
    source =>
      fetchMutation<InvestigationDetail>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/investigations/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        method: 'POST',
        data: {source},
      }),
    options,
    {invalidateCandidates: true}
  );
}

type StartManualInvestigationVariables = {
  projectIds: number[];
  source: ManualInvestigationSource;
};

export function useStartManualInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationDetail, StartManualInvestigationVariables>
) {
  return useInvestigationMutation(
    organizationSlug,
    ({source, projectIds}) =>
      fetchMutation<InvestigationDetail>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/investigations/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        method: 'POST',
        // A manual run can only read the investigation's own projects, so
        // without any it has nothing to query.
        data: {source, projectIds},
      }),
    options
  );
}

export function useRenameInvestigationMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<InvestigationDetail, string>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    scope: {id: `rename-investigation-${investigationId}`},
    mutationFn: title => {
      const current = queryClient.getQueryData(detailOptions.queryKey)?.json;
      if (!current) {
        throw new Error('Investigation detail is not cached.');
      }

      return fetchMutation<InvestigationDetail>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
            },
          }
        ),
        method: 'PUT',
        data: {title, investigationVersion: current.version},
      });
    },
    onSuccess: async (updated, savedTitle, onMutateResult, context) => {
      queryClient.setQueryData(detailOptions.queryKey, current => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          json: {
            ...updated,
            // Preserve newer optimistic block state while the rename was in flight.
            blocks: current.json.blocks,
            blockCount: current.json.blockCount,
            version: Math.max(current.json.version, updated.version),
            // Keep a newer optimistic title while this save was in flight.
            title: current.json.title === savedTitle ? updated.title : current.json.title,
          },
        };
      });
      await queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({organizationSlug}).queryKey,
      });
      await options?.onSuccess?.(updated, savedTitle, onMutateResult, context);
    },
  });
}

export function useDeleteInvestigationBlockMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<void, DeleteBlockVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({block, investigationVersion}) => {
      return fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/$blockId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
              blockId: block.id,
            },
          }
        ),
        method: 'DELETE',
        data: {
          investigationVersion,
          version: block.version,
        },
      });
    },
    onSuccess: async (_data, variables, onMutateResult, context) => {
      queryClient.setQueryData(detailOptions.queryKey, current =>
        current
          ? {
              ...current,
              json: {
                ...current.json,
                blockCount: Math.max(0, current.json.blockCount - 1),
                blocks: current.json.blocks?.filter(
                  block => block.id !== variables.block.id
                ),
                version: current.json.version + 1,
              },
            }
          : current
      );
      await queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({organizationSlug}).queryKey,
      });
      await options?.onSuccess?.(_data, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
      await options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

const cannotApplyReasonSchema = z.enum([
  'investigation_archived',
  'not_suggested',
  'unsupported_action',
  'no_access',
  'permission_denied',
  'not_target_detector',
  'detector_not_found',
  'dynamic_detector',
]);

export type CannotApplyReason = z.infer<typeof cannotApplyReasonSchema>;

const detectorValueSchema = z.union([z.number(), z.string(), z.null()]);

const detectorValuesSchema = z
  .object({
    query: detectorValueSchema,
    aggregate: detectorValueSchema,
    environment: detectorValueSchema,
    timeWindowSeconds: detectorValueSchema,
    highThreshold: detectorValueSchema,
    mediumThreshold: detectorValueSchema,
    resolutionThreshold: detectorValueSchema,
  })
  .partial();

export type InvestigationDetectorValues = z.infer<typeof detectorValuesSchema>;

const actionRequestErrorSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.enum([
      ...cannotApplyReasonSchema.options,
      'already_applied',
      'withdrawn',
      'action_changed',
      'not_stale',
      'not_retryable',
    ]),
  }),
  z.object({
    code: z.literal('stale'),
    current: detectorValuesSchema,
  }),
  z.object({code: z.literal('validation_failed'), messages: z.array(z.string())}),
]);

export type ActionRequestError = z.infer<typeof actionRequestErrorSchema>;

const actionRequestFollowUpSchema = z.object({
  status: z.enum(['accepted', 'dispatched', 'acknowledged', 'failed']),
  reason: z
    .enum([
      'workflow_version_conflict',
      'idempotency_conflict',
      'invalid_command_target',
      'action_requests_report_changed',
      'run_cancelled',
      'run_failed',
      'provider_not_connected',
      'provider_already_used',
    ])
    .nullable(),
  rerun: z.enum(['started', 'held', 'skipped']).nullable(),
  retryable: z.boolean(),
});

export type ActionRequestFollowUp = z.infer<typeof actionRequestFollowUpSchema>;

export function isFollowUpPending(actionRequest: InvestigationActionRequest) {
  const status = actionRequest.followUp?.status;
  return status === 'accepted' || status === 'dispatched';
}

export function canRetryFollowUp(actionRequest: InvestigationActionRequest) {
  return (
    actionRequest.state === 'applied' &&
    actionRequest.followUp?.retryable === true &&
    actionRequest.cannotApplyReason !== 'investigation_archived'
  );
}

export function parseApplyError(error: unknown): ActionRequestError | null {
  const parsed = actionRequestErrorSchema.safeParse(
    error instanceof RequestError ? error.responseJSON : undefined
  );
  return parsed.success ? parsed.data : null;
}

type ActionRequestCommand = 'apply' | 'recheck' | 'retry-follow-up';

function getActionRequestUrl(
  organizationSlug: string,
  investigationId: string,
  actionRequestId: string,
  command: ActionRequestCommand
) {
  const path = {organizationIdOrSlug: organizationSlug, investigationId, actionRequestId};
  switch (command) {
    case 'apply':
      return getApiUrl(
        '/organizations/$organizationIdOrSlug/investigations/$investigationId/action-requests/$actionRequestId/apply/',
        {path}
      );
    case 'recheck':
      return getApiUrl(
        '/organizations/$organizationIdOrSlug/investigations/$investigationId/action-requests/$actionRequestId/recheck/',
        {path}
      );
    case 'retry-follow-up':
      return getApiUrl(
        '/organizations/$organizationIdOrSlug/investigations/$investigationId/action-requests/$actionRequestId/retry-follow-up/',
        {path}
      );
  }
}

export function actionRequestDryRunQueryOptions(
  organizationSlug: string,
  investigationId: string,
  actionRequest: InvestigationActionRequest
) {
  const url = getActionRequestUrl(
    organizationSlug,
    investigationId,
    actionRequest.id,
    'apply'
  );
  const endpoint = {
    method: 'POST',
    data: {dryRun: true, action: actionRequest.action},
  } as const;
  return queryOptions({
    queryKey: [url, endpoint] as const,
    queryFn: async (): Promise<ActionRequestError | null> => {
      try {
        await apiFetch<InvestigationActionRequestApplyResponse>({
          queryKey: [url, endpoint],
        });
        return null;
      } catch (error) {
        const applyError = parseApplyError(error);
        if (applyError) {
          return applyError;
        }
        throw error;
      }
    },
    staleTime: 0,
    retry: false,
  });
}

export function useInvestigationActionRequestMutation(
  organizationSlug: string,
  investigationId: string,
  command: ActionRequestCommand,
  options?: MutationOptions<
    InvestigationActionRequestApplyResponse,
    InvestigationActionRequest
  >
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );
  const orchestrationOptions = investigationOrchestrationQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: actionRequest =>
      fetchMutation<InvestigationActionRequestApplyResponse>({
        url: getActionRequestUrl(
          organizationSlug,
          investigationId,
          actionRequest.id,
          command
        ),
        method: 'POST',
        data: {action: actionRequest.action},
      }),
    onSuccess: async (response, variables, onMutateResult, context) => {
      await queryClient.cancelQueries({queryKey: detailOptions.queryKey});
      queryClient.setQueryData(detailOptions.queryKey, current =>
        current
          ? {
              ...current,
              json: {
                ...current.json,
                actionRequests: current.json.actionRequests?.map(actionRequest =>
                  actionRequest.id === response.actionRequest.id
                    ? response.actionRequest
                    : actionRequest
                ),
              },
            }
          : current
      );
      void queryClient.invalidateQueries({queryKey: orchestrationOptions.queryKey});
      await options?.onSuccess?.(response, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      void queryClient.invalidateQueries({
        queryKey: actionRequestDryRunQueryOptions(
          organizationSlug,
          investigationId,
          variables
        ).queryKey,
      });
      await Promise.all([
        queryClient.invalidateQueries({queryKey: detailOptions.queryKey}),
        queryClient.invalidateQueries({queryKey: orchestrationOptions.queryKey}),
      ]);
      await options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

export function useStopInvestigationExecutionMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<void, StopExecutionVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({blockId, executionId}) =>
      fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/$blockId/executions/$executionId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
              blockId,
              executionId,
            },
          }
        ),
        method: 'DELETE',
      }),
    onSuccess: async (_data, variables, onMutateResult, context) => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: detailOptions.queryKey}),
        queryClient.invalidateQueries({
          queryKey: investigationExecutionDetailQueryOptions({
            organizationSlug,
            investigationId,
            blockId: variables.blockId,
            executionId: variables.executionId,
          }).queryKey,
        }),
      ]);
      await options?.onSuccess?.(_data, variables, onMutateResult, context);
    },
  });
}

export function useResumeInvestigationExecutionMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<void, ResumeExecutionVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({blockId, executionId, inputId, responseData}) =>
      fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/$blockId/executions/$executionId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
              blockId,
              executionId,
            },
          }
        ),
        method: 'PATCH',
        data: {input_id: inputId, response_data: responseData},
      }),
    onSuccess: async (_data, variables, onMutateResult, context) => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: detailOptions.queryKey}),
        queryClient.invalidateQueries({
          queryKey: investigationExecutionDetailQueryOptions({
            organizationSlug,
            investigationId,
            blockId: variables.blockId,
            executionId: variables.executionId,
          }).queryKey,
        }),
      ]);
      await options?.onSuccess?.(_data, variables, onMutateResult, context);
    },
  });
}

export function useSetInvestigationFavoriteMutation(
  organizationSlug: string,
  options?: MutationOptions<void, FavoriteVariables>
) {
  return useInvestigationMutation(
    organizationSlug,
    ({investigation, shouldFavorite}: FavoriteVariables) =>
      fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/favorite/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId: investigation.id,
            },
          }
        ),
        method: 'PUT',
        data: {shouldFavorite},
      }),
    options
  );
}

export function useDuplicateInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationListItem, InvestigationListItem>
) {
  return useInvestigationMutation(
    organizationSlug,
    investigation =>
      fetchMutation<InvestigationListItem>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/duplicate/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId: investigation.id,
            },
          }
        ),
        method: 'POST',
      }),
    options
  );
}

export function useDeleteInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<void, InvestigationListItem>
) {
  return useInvestigationMutation(
    organizationSlug,
    investigation =>
      fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId: investigation.id,
            },
          }
        ),
        method: 'DELETE',
        data: {investigationVersion: investigation.version},
      }),
    options,
    {invalidateCandidates: true}
  );
}
