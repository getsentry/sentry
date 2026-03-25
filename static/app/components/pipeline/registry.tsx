import {dummyIntegrationPipeline} from './pipelineDummyProvider';
import {bitbucketIntegrationPipeline} from './pipelineIntegrationBitbucket';
import {githubIntegrationPipeline} from './pipelineIntegrationGitHub';
import {gitlabIntegrationPipeline} from './pipelineIntegrationGitLab';

/**
 * All registered pipeline definitions.
 */
export const PIPELINE_REGISTRY = [
  bitbucketIntegrationPipeline,
  dummyIntegrationPipeline,
  githubIntegrationPipeline,
  gitlabIntegrationPipeline,
] as const;

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
 * Resolves the provider definition for a given type + provider combo.
 */
type ProviderDefintionFor<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
> = Extract<AllPipelines, {provider: P; type: T}>;

/**
 * Resolves the completion data type for a given type + provider combo.
 */
export type CompletionDataFor<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
> = ReturnType<ProviderDefintionFor<T, P>['getCompletionData']>;

/**
 * Look up a pipeline definition by type and provider.
 */
export function getPipelineDefinition<
  T extends RegisteredPipelineType,
  P extends ProvidersByType[T],
>(type: T, provider: P): ProviderDefintionFor<T, P> {
  const match = PIPELINE_REGISTRY.find(p => p.type === type && p.provider === provider);

  if (!match) {
    throw new Error(`No pipeline definition registered for ${type}/${provider}`);
  }

  return match as ProviderDefintionFor<T, P>;
}
