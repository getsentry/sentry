import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
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
  PipelineCompletionProps,
  PipelineStepProps,
  PipelineStepResponse,
} from './types';
import {getBackendPipelineType} from './types';

type PipelineState<T extends RegisteredPipelineType, P extends ProvidersByType[T]> =
  | {status: 'idle'}
  | {status: 'initializing'}
  | {
      status: 'active';
      stepData: Record<string, unknown>;
      stepInfo: PipelineStepResponse;
    }
  | {data: CompletionDataFor<T, P>; status: 'complete'}
  | {error: Error; status: 'error'};

interface UsePipelineOptions<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
> {
  enabled?: boolean;
  onComplete?: (data: CompletionDataFor<T, P>) => void;
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
export function usePipeline<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
>(
  type: T,
  provider: P,
  options: UsePipelineOptions<T, P> = {}
): ApiPipeline<CompletionDataFor<T, P>> {
  const organization = useOrganization();
  const [state, setState] = useState<PipelineState<T, P>>({status: 'idle'});
  const initializedRef = useRef(false);
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;
  const generationRef = useRef(0);

  const {enabled = true} = options;

  const pipelineName = getBackendPipelineType(type);
  const apiUrl = `/organizations/${organization.slug}/pipeline/${pipelineName}/`;

  const definition = useMemo(
    () => getPipelineDefinition(type, provider),
    [type, provider]
  );

  const {mutate: initializeMutate, ...initializeRest} = useMutation<
    PipelineStepResponse,
    Error,
    void,
    {generation: number}
  >({
    mutationFn: () =>
      fetchMutation<PipelineStepResponse>({
        method: 'POST',
        url: apiUrl,
        data: {action: 'initialize', provider},
      }),
    onMutate: () => ({generation: generationRef.current}),
    onSuccess: (data: PipelineStepResponse, _variables, context) => {
      if (context?.generation !== generationRef.current) {
        return;
      }
      setState({status: 'active', stepInfo: data, stepData: data.data});
    },
    onError: (error: Error, _variables, context) => {
      if (context?.generation !== generationRef.current) {
        return;
      }
      setState({status: 'error', error});
    },
  });

  const {
    mutate: advanceMutate,
    isPending: isAdvancePending,
    error: advanceError,
    reset: resetAdvance,
  } = useMutation<
    PipelineAdvanceResponse,
    RequestError,
    Record<string, unknown>,
    {generation: number}
  >({
    mutationFn: (data: Record<string, unknown>) =>
      fetchMutation<PipelineAdvanceResponse>({
        method: 'POST',
        url: apiUrl,
        data,
      }),
    onMutate: () => ({generation: generationRef.current}),
    onSuccess: (response: PipelineAdvanceResponse, _variables, context) => {
      if (context?.generation !== generationRef.current) {
        return;
      }
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
          setState(prev =>
            prev.status === 'active'
              ? {...prev, stepData: {...prev.stepData, ...response.data}}
              : prev
          );
          break;
        case 'complete': {
          const rawData = response.data ?? {};

          // Widen from the specific union of completion data types to the specific
          // completion data.
          const data = definition.getCompletionData(rawData) as CompletionDataFor<T, P>;

          setState({status: 'complete', data});

          // If there's no completion view, fire onComplete immediately.
          if (!definition.completionView) {
            onCompleteRef.current?.(data);
          }
          break;
        }
        case 'error':
          setState({
            status: 'error',
            error: new Error((response.data?.detail as string) ?? 'Pipeline error'),
          });
          break;
      }
    },
    onError: (error: RequestError, _variables, context) => {
      if (context?.generation !== generationRef.current) {
        return;
      }
      // 404 means the pipeline session expired — unrecoverable.
      if (error.status === 404) {
        setState({
          status: 'error',
          error: new Error(t('This flow has expired. Please start over.')),
        });
        return;
      }
      // Other 4xx errors are recoverable (e.g. validation failures) and are
      // surfaced via advanceError. Only transition to the error state for
      // 5xx or unknown errors which are unrecoverable.
      if (!error.status || error.status >= 500) {
        setState({status: 'error', error});
      }
    },
  });

  const restart = useCallback(() => {
    generationRef.current += 1;
    resetAdvance();
    setState({status: 'initializing'});
    initializeMutate();
  }, [initializeMutate, resetAdvance]);

  // Initialize the pipeline on mount when enabled
  useEffect(() => {
    if (enabled && !initializedRef.current) {
      initializedRef.current = true;
      restart();
    }
  }, [enabled, restart]);

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

  const finish = useCallback(() => {
    if (state.status === 'complete') {
      onCompleteRef.current?.(state.data);
    }
  }, [state]);

  const view = useMemo(() => {
    // Render completion view when the pipeline is complete and one is defined
    if (state.status === 'complete' && definition.completionView) {
      const CompletionView: React.ComponentType<PipelineCompletionProps<any>> =
        definition.completionView;
      return <CompletionView data={state.data} finish={finish} />;
    }

    if (!stepDefinition) {
      return null;
    }

    const isActive = state.status === 'active';

    // Widen from the specific union of component types to the general
    // PipelineStepDefinition component type
    const Component: React.ComponentType<PipelineStepProps<any, any>> =
      stepDefinition.component;

    return (
      <Component
        stepIndex={isActive ? state.stepInfo.stepIndex : 0}
        totalSteps={isActive ? state.stepInfo.totalSteps : definition.steps.length}
        stepData={isActive ? state.stepData : {}}
        advance={advanceMutate}
        isAdvancing={isAdvancePending}
        advanceError={advanceError}
      />
    );
  }, [
    state,
    stepDefinition,
    definition,
    advanceMutate,
    isAdvancePending,
    advanceError,
    finish,
  ]);

  const {stepIndex, totalSteps} =
    state.status === 'active'
      ? {stepIndex: state.stepInfo.stepIndex, totalSteps: state.stepInfo.totalSteps}
      : {stepIndex: 0, totalSteps: definition.steps.length};

  // Pipeline-level error displayed by the modal as a full-width alert with a
  // "Start over" button. When state.status is 'error', the pipeline has hit an
  // unrecoverable failure (backend PipelineStepResult.error() response, expired
  // session, or 5xx). Otherwise falls back to initialization errors or
  // advanceError — but only when it carries a `detail` message (a non-field
  // error). Field-level validation errors from advanceError are handled by step
  // components via setFieldErrors() and don't surface here.
  const advanceDetailError =
    advanceError && typeof (advanceError.responseJSON as any)?.detail === 'string'
      ? ((advanceError.responseJSON as any).detail as string)
      : null;

  const rawError =
    state.status === 'error' ? state.error : (initializeRest.error ?? null);

  const error = rawError
    ? ((rawError instanceof RequestError
        ? ((rawError.responseJSON as any)?.detail as string | undefined)
        : undefined) ?? rawError.message)
    : advanceDetailError;

  const completionData = state.status === 'complete' ? state.data : null;

  return {
    view,
    restart,
    definition,
    stepDefinition,
    stepIndex,
    totalSteps,
    isInitializing: state.status === 'initializing' || initializeRest.isPending,
    isAdvancing: isAdvancePending,
    isComplete: state.status === 'complete',
    error,
    completionData,
  };
}
