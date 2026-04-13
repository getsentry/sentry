import {RequestError} from 'sentry/utils/requestError/requestError';

const PIPELINE_NAME_MAP = {
  integration: 'integration_pipeline',
  identity: 'identity_provider',
} as const;

type PipelineType = keyof typeof PIPELINE_NAME_MAP;

export function getBackendPipelineType(type: PipelineType): string {
  return PIPELINE_NAME_MAP[type];
}

/**
 * A single step in a pipeline definition.
 */
export interface PipelineStepDefinition<StepId extends string = string> {
  /**
   * The React component rendered for this step. Receives step data,
   * an advance callback, and error state via {@link PipelineStepProps}.
   */
  component: React.ComponentType<PipelineStepProps<any, any>>;
  /**
   * Human-readable label shown in the modal header (e.g. "Selecting a project").
   */
  shortDescription: string;
  /**
   * Unique identifier for this step, matching the backend step ID.
   */
  stepId: StepId;
}

/**
 * Props passed to a pipeline's completion view component.
 */
export interface PipelineCompletionProps<D = unknown> {
  data: D;
  finish: () => void;
}

/**
 * Defines a complete pipeline with its type, provider, and ordered steps.
 */
export interface PipelineDefinition<
  T extends PipelineType = PipelineType,
  P extends string = string,
> {
  /**
   * Title displayed in the pipeline modal header.
   */
  actionTitle: string;
  /**
   * Component rendered after the pipeline completes. When set, `onComplete`
   * is deferred until the component calls `finish()`. When null, `onComplete`
   * fires immediately on completion.
   */
  completionView: React.ComponentType<PipelineCompletionProps<any>> | null;
  /**
   * Casts the raw completion response to the typed completion data shape.
   * Use the {@link pipelineComplete} helper for this.
   */
  getCompletionData: (data: Record<string, unknown>) => unknown;
  /**
   * The integration provider key (e.g. 'github', 'aws_lambda').
   */
  provider: P;
  /**
   * Ordered list of step definitions that make up this pipeline.
   */
  steps: readonly PipelineStepDefinition[];
  /**
   * The pipeline type (e.g. 'integration', 'identity').
   */
  type: T;
}

/**
 * Props passed to each pipeline step component.
 * The step component should NOT interact with pipeline APIs directly.
 */
export interface PipelineStepProps<
  D = Record<string, unknown>,
  A = Record<string, unknown>,
> {
  advance: (data?: A) => void;
  advanceError: RequestError | null;
  isAdvancing: boolean;
  stepData: D;
  stepIndex: number;
  totalSteps: number;
}

/**
 * Identity function that asserts the raw completion data to a typed shape.
 * Avoids the verbose `(data: Record<string, unknown>) => data as unknown as T`
 * boilerplate in every pipeline definition.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function pipelineComplete<T>(data: Record<string, unknown>): T {
  return data as unknown as T;
}

/**
 * Response from the pipeline API for step info (GET or after initialize).
 */
export interface PipelineStepResponse {
  data: Record<string, unknown>;
  provider: string;
  step: string;
  stepIndex: number;
  totalSteps: number;
}

/**
 * Response from the pipeline API after advancing a step.
 */
export interface PipelineAdvanceResponse {
  status: 'advance' | 'stay' | 'error' | 'complete';
  data?: Record<string, unknown>;
  provider?: string;
  step?: string;
  stepIndex?: number;
  totalSteps?: number;
}

/**
 * Return type of the usePipeline hook.
 */
export interface ApiPipeline<C = Record<string, unknown>> {
  completionData: C | null;
  definition: PipelineDefinition;
  error: string | null;
  isAdvancing: boolean;
  isComplete: boolean;
  isInitializing: boolean;
  restart: () => void;
  stepDefinition: PipelineStepDefinition | null;
  stepIndex: number;
  totalSteps: number;
  view: React.ReactNode;
}
