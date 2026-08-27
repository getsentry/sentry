import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {
  InvestigationCandidate,
  InvestigationBlock,
  InvestigationBlockExecutionStart,
  InvestigationBlockKind,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationListItem,
  InvestigationOrchestration,
  InvestigationOrchestrationCommandResponse,
  InvestigationOrchestrationCommandVariables,
  InvestigationTitleGeneration,
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

export function useInvestigationOrchestrationCommandMutation(
  organizationSlug: string,
  investigationId: string
) {
  const queryClient = useQueryClient();
  const orchestrationOptions = investigationOrchestrationQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    scope: {id: `investigation-orchestration-command-${investigationId}`},
    mutationFn: (variables: InvestigationOrchestrationCommandVariables) =>
      fetchMutation<InvestigationOrchestrationCommandResponse>({
        url: `/organizations/${organizationSlug}/investigations/${investigationId}/orchestration/commands/`,
        method: 'POST',
        data: variables,
      }),
    retry: (failureCount, error) =>
      isTransientInvestigationOrchestrationError(error) && failureCount < 1,
    onSuccess: response => {
      queryClient.setQueryData(orchestrationOptions.queryKey, current => ({
        headers: current?.headers ?? {},
        json: response.projection,
      }));
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: orchestrationOptions.queryKey,
      });
    },
  });
}

export function getInvestigationOrchestrationPollInterval({
  error,
  failureCount,
  orchestration,
}: {
  error: unknown;
  failureCount: number;
  orchestration: InvestigationOrchestration | undefined;
}) {
  if (isInvestigationOrchestrationNotFoundError(error)) {
    return false;
  }
  if (error && isTransientInvestigationOrchestrationError(error)) {
    return Math.min(2000 * 2 ** Math.max(failureCount, 1), 30_000);
  }
  return orchestration && !isInvestigationOrchestrationTerminal(orchestration.status)
    ? 2000
    : false;
}

export function shouldRetryInvestigationOrchestration(
  failureCount: number,
  error: unknown
) {
  return (
    !isInvestigationOrchestrationNotFoundError(error) &&
    isTransientInvestigationOrchestrationError(error) &&
    failureCount < 2
  );
}

export function isInvestigationOrchestrationNotFoundError(error: unknown) {
  return error instanceof RequestError && error.status === 404;
}

export function isInvestigationOrchestrationConflictError(error: unknown) {
  return error instanceof RequestError && error.status === 409;
}

function isTransientInvestigationOrchestrationError(error: unknown) {
  return (
    !(error instanceof RequestError) || error.status === undefined || error.status >= 500
  );
}

function isInvestigationOrchestrationTerminal(
  status: InvestigationOrchestration['status']
) {
  return ['completed', 'failed', 'cancelled'].includes(status);
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
      data: {
        templateKey: 'breached_metric',
        templateVersion: 1,
        sources,
      },
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

type AddBlockVariables = {
  investigation: InvestigationDetail;
  kind: InvestigationBlockKind;
  prompt: string;
  title: string;
};

type RunBlockVariables = {
  block: InvestigationBlock;
  investigationVersion: number;
};

type UpdateBlockPromptVariables = {
  block: InvestigationBlock;
  investigationVersion: number;
  prompt: string;
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

export function useCreateInvestigationMutation(
  organizationSlug: string,
  options?: MutationOptions<InvestigationListItem, void>
) {
  return useInvestigationMutation(
    organizationSlug,
    () =>
      fetchMutation<InvestigationListItem>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/investigations/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        method: 'POST',
        data: {
          title: 'Untitled investigation',
          mode: 'agentic',
          source: {type: 'manual'},
        },
      }),
    options
  );
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
        data: {
          mode: 'agentic',
          source,
        },
      }),
    options,
    {invalidateCandidates: true}
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
          headers: current.headers,
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

export function useAddInvestigationBlockMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<InvestigationBlock, AddBlockVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({investigation, kind, prompt, title}) =>
      fetchMutation<InvestigationBlock>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
            },
          }
        ),
        method: 'POST',
        data: {
          investigationVersion: investigation.version,
          kind,
          title,
          generationPrompt: prompt,
        },
      }),
    onSuccess: async (block, variables, onMutateResult, context) => {
      queryClient.setQueryData(detailOptions.queryKey, current =>
        current
          ? {
              ...current,
              json: {
                ...current.json,
                blockCount: current.json.blockCount + 1,
                blocks: [...(current.json.blocks ?? []), block],
                version: current.json.version + 1,
              },
            }
          : current
      );
      await queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({organizationSlug}).queryKey,
      });
      await options?.onSuccess?.(block, variables, onMutateResult, context);
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

export function useRunInvestigationBlockMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<InvestigationBlockExecutionStart, RunBlockVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({block, investigationVersion}) =>
      fetchMutation<InvestigationBlockExecutionStart>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/investigations/$investigationId/blocks/$blockId/executions/',
          {
            path: {
              organizationIdOrSlug: organizationSlug,
              investigationId,
              blockId: block.id,
            },
          }
        ),
        method: 'POST',
        data: {
          investigationVersion,
          version: block.version,
        },
      }),
    onSuccess: async (execution, variables, onMutateResult, context) => {
      queryClient.setQueryData(detailOptions.queryKey, current =>
        current
          ? {
              ...current,
              json: {
                ...current.json,
                blocks: current.json.blocks?.map(block =>
                  block.id === variables.block.id
                    ? {
                        ...block,
                        outputStatus: execution.status,
                        currentExecution: {
                          id: execution.id,
                          status: execution.status,
                          startedAt: null,
                          completedAt: null,
                          error: null,
                        },
                      }
                    : block
                ),
              },
            }
          : current
      );
      await queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
      await options?.onSuccess?.(execution, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
      await options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}

export function useUpdateInvestigationBlockPromptMutation(
  organizationSlug: string,
  investigationId: string,
  options?: MutationOptions<InvestigationBlock, UpdateBlockPromptVariables>
) {
  const queryClient = useQueryClient();
  const detailOptions = getInvestigationDetailQueryOptions(
    organizationSlug,
    investigationId
  );

  return useMutation({
    ...options,
    mutationFn: ({block, investigationVersion, prompt}) =>
      fetchMutation<InvestigationBlock>({
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
        method: 'PUT',
        data: {
          investigationVersion,
          version: block.version,
          generationPrompt: prompt,
        },
      }),
    onSuccess: async (updatedBlock, variables, onMutateResult, context) => {
      queryClient.setQueryData(detailOptions.queryKey, current =>
        current
          ? {
              ...current,
              json: {
                ...current.json,
                blocks: current.json.blocks?.map(block =>
                  block.id === updatedBlock.id ? updatedBlock : block
                ),
                version:
                  current.json.version +
                  (updatedBlock.version === variables.block.version ? 0 : 1),
              },
            }
          : current
      );
      await options?.onSuccess?.(updatedBlock, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
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
