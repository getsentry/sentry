import {useEffect, useMemo, useRef, useState} from 'react';

import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getPipelineDefinition} from './registry';
import type {
  CompletionDataFor,
  ProvidersByType,
  RegisteredPipelineType,
} from './registry';
import type {
  ApiPipeline,
  PipelineAdvanceResponse,
  PipelineStepProps,
  PipelineStepResponse,
} from './types';
import {PIPELINE_NAME_MAP} from './types';

type PipelineState =
  | {status: 'idle'}
  | {status: 'initializing'}
  | {
      status: 'active';
      stepData: Record<string, unknown>;
      stepInfo: PipelineStepResponse;
    }
  | {data: Record<string, unknown>; status: 'complete'}
  | {error: Error; status: 'error'};

interface UsePipelineOptions<T extends RegisteredPipelineType> {
  enabled?: boolean;
  onComplete?: (data: CompletionDataFor<T, ProvidersByType[T]>) => void;
}

/**
 * React hook that drives a backend pipeline via the organization pipeline API.
 *
 * ## How it maps to the backend
 *
 * The backend pipeline system (`sentry.pipeline.base.Pipeline`) manages a
 * sequence of steps stored in the user's session. There are two pipeline
 * types: integration pipelines (GitHub, Bitbucket, Jira, Slack, etc.) and
 * identity association pipelines (Google SSO, SAML, etc.). Each provider
 * defines its own pipeline subclass with ordered steps.
 *
 * When a pipeline is configured for API mode (`get_pipeline_api_steps()`),
 * the `OrganizationPipelineEndpoint` at
 * `/api/0/organizations/:org/pipeline/:pipeline_name/` exposes the pipeline
 * over REST:
 *
 *   - **POST {action: 'initialize', provider}** — creates a new pipeline
 *     session and returns the first step's info (name, index, data).
 *   - **GET** — returns the current step's info, including step data
 *     from the step's `get_step_data()` method.
 *   - **POST {step data}** — validates the posted data via the step's
 *     serializer, calls `handle_post()`, and returns one of:
 *       - `advance` — pipeline moved to the next step (response includes
 *         the new step's info via `get_current_step_info()`).
 *       - `stay` — same step, updated data (e.g. a redirect URL).
 *       - `complete` — pipeline finished, response includes completion data.
 *       - `error` — validation or processing failed.
 *
 * ## How this hook works
 *
 * On mount (when `enabled`), the hook initializes the pipeline and enters
 * the `active` state with the first step's data. It looks up the matching
 * step component from the frontend pipeline definition (registered in
 * `registry.tsx`) and renders it via the returned `view` property.
 *
 * Each step component receives `stepData` (from the backend) and an
 * `advance` callback. When the step calls `advance(data)`, the hook POSTs
 * to the pipeline endpoint and transitions based on the response status.
 *
 * The hook is provider-typed: `usePipeline('integration', 'github')` infers
 * the correct completion data type from the pipeline definition's
 * `onComplete` return type.
 */
export function usePipeline<T extends RegisteredPipelineType>(
  type: T,
  provider: ProvidersByType[T],
  options: UsePipelineOptions<T> = {}
): ApiPipeline<CompletionDataFor<T, ProvidersByType[T]>> {
  const organization = useOrganization();
  const [state, setState] = useState<PipelineState>({status: 'idle'});
  const initializedRef = useRef(false);
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;

  const {enabled = true} = options;

  const pipelineName = PIPELINE_NAME_MAP[type];
  const apiUrl = `/organizations/${organization.slug}/pipeline/${pipelineName}/`;

  const definition = useMemo(
    () => getPipelineDefinition(type, provider),
    [type, provider]
  );

  const {mutate: initialize, ...initializeRest} = useMutation<
    PipelineStepResponse,
    Error,
    void
  >({
    mutationFn: () =>
      fetchMutation<PipelineStepResponse>({
        method: 'POST',
        url: apiUrl,
        data: {action: 'initialize', provider},
      }),
    onSuccess: (data: PipelineStepResponse) => {
      setState({status: 'active', stepInfo: data, stepData: data.data});
    },
    onError: (error: Error) => {
      setState({status: 'error', error});
    },
  });

  const {
    mutate: advance,
    isPending: isAdvancePending,
    error: advanceError,
  } = useMutation<PipelineAdvanceResponse, Error, Record<string, unknown>>({
    mutationFn: (data: Record<string, unknown>) =>
      fetchMutation<PipelineAdvanceResponse>({
        method: 'POST',
        url: apiUrl,
        data,
      }),
    onSuccess: (response: PipelineAdvanceResponse) => {
      switch (response.status) {
        case 'advance':
          if (
            response.step !== undefined &&
            response.stepIndex !== undefined &&
            response.totalSteps !== undefined
          ) {
            setState({
              status: 'active',
              stepInfo: {
                step: response.step,
                stepIndex: response.stepIndex,
                totalSteps: response.totalSteps,
                provider: response.provider ?? provider,
                data: response.data ?? {},
              },
              stepData: response.data ?? {},
            });
          }
          break;
        case 'stay':
          // Same step, updated data (e.g. redirect URL)
          setState(prev => {
            if (prev.status !== 'active') {
              return prev;
            }
            return {
              ...prev,
              stepData: {...prev.stepData, ...response.data},
            };
          });
          break;
        case 'complete': {
          const rawData = response.data ?? {};
          setState({status: 'complete', data: rawData});
          const transformed = definition?.onComplete(rawData) as
            | CompletionDataFor<T, ProvidersByType[T]>
            | undefined;
          if (transformed) {
            onCompleteRef.current?.(transformed);
          }
          break;
        }
        case 'error':
          setState({
            status: 'error',
            error: new Error((response.data?.detail as string) ?? 'Pipeline error'),
          });
          break;
        default:
          break;
      }
    },
    onError: (error: Error) => {
      setState({status: 'error', error});
    },
  });

  // Initialize the pipeline on mount when enabled
  useEffect(() => {
    if (enabled && !initializedRef.current) {
      initializedRef.current = true;
      setState({status: 'initializing'});
      initialize();
    }
  }, [enabled, initialize]);

  const stepDefinition = useMemo(() => {
    if (state.status === 'active') {
      return definition.steps.find(s => s.stepId === state.stepInfo.step) ?? null;
    }
    // Optimistically return the first step while initializing so the UI
    // can render the step component immediately (with empty data).
    if (state.status === 'initializing') {
      return definition.steps[0] ?? null;
    }
    return null;
  }, [state, definition]);

  const view = useMemo(() => {
    if (!stepDefinition) {
      return null;
    }

    const isActive = state.status === 'active';

    // Widen from the specific union of component types to the general
    // PipelineStepDefinition component type so createElement accepts it.
    const Component = stepDefinition.component;

    return (
      <Component
        stepIndex={isActive ? state.stepInfo.stepIndex : 0}
        totalSteps={isActive ? state.stepInfo.totalSteps : definition.steps.length}
        stepData={isActive ? state.stepData : {}}
        advance={advance}
        isAdvancing={isAdvancePending}
        advanceError={advanceError}
      />
    );
  }, [state, stepDefinition, definition, advance, isAdvancePending, advanceError]);

  return {
    view,
    definition,
    stepDefinition,
    stepIndex: state.status === 'active' ? state.stepInfo.stepIndex : 0,
    totalSteps:
      state.status === 'active' ? state.stepInfo.totalSteps : definition.steps.length,
    isInitializing: state.status === 'initializing' || initializeRest.isPending,
    isAdvancing: isAdvancePending,
    isComplete: state.status === 'complete',
    error:
      state.status === 'error'
        ? state.error
        : (advanceError ?? initializeRest.error ?? null),
    completionData: (state.status === 'complete'
      ? state.data
      : null) as CompletionDataFor<T, ProvidersByType[T]> | null,
  };
}
