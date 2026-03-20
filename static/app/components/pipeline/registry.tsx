import type {PipelineDefinition} from './types';

/**
 * All registered pipeline definitions.
 */
export const PIPELINE_REGISTRY: readonly PipelineDefinition[] = [] as const;

type AllPipelines = (typeof PIPELINE_REGISTRY)[number];

/**
 * Union of all registered pipeline types.
 */
export type RegisteredPipelineType = AllPipelines['type'];

/**
 * Maps each registered pipeline type to its available providers.
 */
export type ProvidersByType = {
  [T in RegisteredPipelineType]: Extract<AllPipelines, {type: T}>['provider'];
};

/**
 * Resolves the completion data type for a given type + provider combo.
 */
export type CompletionDataFor<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
> = ReturnType<Extract<AllPipelines, {provider: P; type: T}>['onComplete']>;

/**
 * Look up a pipeline definition by type and provider.
 */
export function getPipelineDefinition<T extends RegisteredPipelineType>(
  type: T,
  provider: ProvidersByType[T]
): Extract<AllPipelines, {provider: ProvidersByType[T]; type: T}> {
  const match = PIPELINE_REGISTRY.find(p => p.type === type && p.provider === provider);

  if (!match) {
    throw new Error(`No pipeline definition registered for ${type}/${provider}`);
  }

  return match as Extract<AllPipelines, {provider: ProvidersByType[T]; type: T}>;
}
