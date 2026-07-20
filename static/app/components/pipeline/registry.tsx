import {dummyIntegrationPipeline} from './dummyProvider';
import {awsLambdaIntegrationPipeline} from './integrationAwsLambda';
import {bitbucketIntegrationPipeline} from './integrationBitbucket';
import {bitbucketServerIntegrationPipeline} from './integrationBitbucketServer';
import {claudeCodeIntegrationPipeline} from './integrationClaudeCode';
import {cursorIntegrationPipeline} from './integrationCursor';
import {datadogIntegrationPipeline} from './integrationDatadog';
import {discordIntegrationPipeline} from './integrationDiscord';
import {githubIntegrationPipeline} from './integrationGitHub';
import {githubEnterpriseIntegrationPipeline} from './integrationGitHubEnterprise';
import {gitlabIntegrationPipeline} from './integrationGitLab';
import {jiraIntegrationPipeline} from './integrationJira';
import {jiraServerIntegrationPipeline} from './integrationJiraServer';
import {msTeamsIntegrationPipeline} from './integrationMsTeams';
import {opsgenieIntegrationPipeline} from './integrationOpsgenie';
import {pagerDutyIntegrationPipeline} from './integrationPagerDuty';
import {perforceIntegrationPipeline} from './integrationPerforce';
import {
  slackIntegrationPipeline,
  slackStagingIntegrationPipeline,
} from './integrationSlack';
import {vercelIntegrationPipeline} from './integrationVercel';
import {vstsIntegrationPipeline} from './integrationVsts';

/**
 * All registered pipeline definitions.
 */
export const PIPELINE_REGISTRY = [
  awsLambdaIntegrationPipeline,
  bitbucketIntegrationPipeline,
  bitbucketServerIntegrationPipeline,
  claudeCodeIntegrationPipeline,
  cursorIntegrationPipeline,
  datadogIntegrationPipeline,
  discordIntegrationPipeline,
  dummyIntegrationPipeline,
  githubIntegrationPipeline,
  githubEnterpriseIntegrationPipeline,
  gitlabIntegrationPipeline,
  jiraIntegrationPipeline,
  jiraServerIntegrationPipeline,
  msTeamsIntegrationPipeline,
  opsgenieIntegrationPipeline,
  pagerDutyIntegrationPipeline,
  perforceIntegrationPipeline,
  slackIntegrationPipeline,
  slackStagingIntegrationPipeline,
  vstsIntegrationPipeline,
  vercelIntegrationPipeline,
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
