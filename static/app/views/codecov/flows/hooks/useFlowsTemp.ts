import {useCallback, useEffect, useState} from 'react';

import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  CreateFlowApiRequest,
  CreateFlowApiResponse,
  FlowDefinition,
  FlowsApiResponse,
} from 'sentry/views/codecov/flows/types';

function useLocalStorageFlows() {
  const STORAGE_KEY = 'codecov-flows';
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Helper to create a new FlowDefinition from request data.
   */
  function createNewFlowDefinition(flowData: CreateFlowApiRequest): FlowDefinition {
    const now = new Date().toISOString();
    return {
      ...flowData,
      id: Math.random().toString(36).slice(2),
      createdAt: now,
      updatedAt: now,
      steps: [],
      version: '1',
      status: flowData.status,
      createdBy: flowData.createdBy,
    };
  }

  // Consolidated helpers inside the hook
  const loadFlowsFromLocalStorage = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  };

  const saveFlowsToLocalStorage = (newFlows: FlowDefinition[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFlows));
  };

  // Load flows from localStorage
  useEffect(() => {
    setIsLoading(true);
    try {
      setFlows(loadFlowsFromLocalStorage());
      setIsLoading(false);
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, []);

  // Save flows to localStorage and update state
  const saveFlows = (newFlows: FlowDefinition[]) => {
    setFlows(newFlows);
    saveFlowsToLocalStorage(newFlows);
  };

  // Create flow handler
  const createFlow = useCallback(
    async (flowData: CreateFlowApiRequest): Promise<FlowDefinition> => {
      setIsCreating(true);
      try {
        const newFlow = createNewFlowDefinition(flowData);
        const updated = [...flows, newFlow];
        saveFlows(updated);
        setIsCreating(false);
        return newFlow;
      } catch (e) {
        setIsCreating(false);
        throw e;
      }
    },
    [flows]
  );

  // Delete flow handler
  const deleteFlow = useCallback(
    (flowId: string) => {
      setIsDeleting(true);
      try {
        const updated = flows.filter(f => f.id !== flowId);
        saveFlows(updated);
        setIsDeleting(false);
      } catch (e) {
        setIsDeleting(false);
        throw e;
      }
    },
    [flows]
  );

  // Refetch just reloads from localStorage
  const refetch = useCallback(() => {
    try {
      setFlows(loadFlowsFromLocalStorage());
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e : new Error('Unknown error'));
    }
  }, []);

  return {
    flows,
    isLoading,
    isError,
    error,
    isCreating,
    isDeleting,
    createFlow,
    deleteFlow,
    refetch,
  };
}


export function useFlows() {
  // Always call hooks unconditionally
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  // Local storage fallback
  const localStorageFlows = useLocalStorageFlows();

  // If using local storage, return that implementation
  if (USE_LOCAL_STORAGE_FLOWS) {
    return localStorageFlows;
  }

  // Fetch all flows for the org
  const {data, isLoading, isError, error, refetch} = useApiQuery<FlowsApiResponse>(
    [`/organizations/${organization.slug}/flows/`],
    {
      staleTime: 30000,
      enabled: !!organization.slug,
    }
  );

  // Create flow mutation
  const {mutateAsync: createFlowMutateAsync, isPending: isCreating} = useMutation<
    CreateFlowApiResponse,
    any,
    CreateFlowApiRequest
  >({
    mutationFn: flowData =>
      api.requestPromise(`/organizations/${organization.slug}/flows/`, {
        method: 'POST',
        data: flowData,
      }),
    onSuccess: (response: CreateFlowApiResponse) => {
      // Optimistically update the cache
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/${organization.slug}/flows/`],
        oldData => ({
          ...oldData,
          data: [...(oldData?.data || []), response.data],
        })
      );
    },
  });

  // Delete flow mutation
  const {mutate: deleteFlowMutate, isPending: isDeleting} = useMutation<
    void,
    any,
    string
  >({
    mutationFn: flowId =>
      api.requestPromise(`/organizations/${organization.slug}/flows/${flowId}/`, {
        method: 'DELETE',
      }),
    onSuccess: (_, flowId) => {
      // Optimistically update the cache
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/${organization.slug}/flows/`],
        oldData => ({
          ...oldData,
          data: (oldData?.data || []).filter(flow => flow.id !== flowId),
        })
      );
    },
  });

  // Create flow handler
  const createFlow = useCallback(
    async (flowData: CreateFlowApiRequest): Promise<FlowDefinition> => {
      const response = await createFlowMutateAsync(flowData);
      return response.data;
    },
    [createFlowMutateAsync]
  );

  // Delete flow handler
  const deleteFlow = useCallback(
    (flowId: string) => {
      deleteFlowMutate(flowId);
    },
    [deleteFlowMutate]
  );

  return {
    data: data?.data ?? [],
    isLoading,
    isError,
    error,
    isCreating,
    isDeleting,
    createFlow,
    deleteFlow,
    refetch,
  };
}

export default useFlows;
