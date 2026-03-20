/**
 * Maps frontend pipeline type names to backend pipeline_name values.
 */
export const PIPELINE_NAME_MAP = {
  integration: 'integration_pipeline',
  identity: 'identity_provider',
} as const;

export type PipelineType = keyof typeof PIPELINE_NAME_MAP;

/**
 * A single step in a pipeline definition.
 */
export interface PipelineStepDefinition<StepId extends string = string> {
  component: React.ComponentType<PipelineStepProps<any, any>>;
  shortDescription: string;
  stepId: StepId;
}

/**
 * Defines a complete pipeline with its type, provider, and ordered steps.
 */
export interface PipelineDefinition<
  T extends PipelineType = PipelineType,
  P extends string = string,
> {
  actionTitle: string;
  onComplete: (data: Record<string, unknown>) => unknown;
  provider: P;
  steps: readonly PipelineStepDefinition[];
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
  advanceError: Error | null;
  isAdvancing: boolean;
  stepData: D;
  stepIndex: number;
  totalSteps: number;
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
  error: Error | null;
  isAdvancing: boolean;
  isComplete: boolean;
  isInitializing: boolean;
  stepDefinition: PipelineStepDefinition | null;
  stepIndex: number;
  totalSteps: number;
  view: React.ReactNode;
}
