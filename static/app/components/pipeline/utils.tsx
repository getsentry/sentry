import type {PipelineType} from 'sentry/components/pipeline/types';

const PIPELINE_NAME_MAP = {
  integration: 'integration_pipeline',
  identity: 'identity_provider',
} as const satisfies Record<PipelineType, string>;

export function getBackendPipelineType(type: PipelineType): string {
  return PIPELINE_NAME_MAP[type];
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
