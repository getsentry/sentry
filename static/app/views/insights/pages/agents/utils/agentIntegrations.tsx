export enum AgentIntegration {
  OPENAI = 'openai',
  OPENAI_AGENTS = 'openai_agents',
  ANTHROPIC = 'anthropic',
  GOOGLE_GENAI = 'google_genai',
  LANGCHAIN = 'langchain',
  LANGGRAPH = 'langgraph',
  LITTELLM = 'litellm',
  MASTRA = 'mastra',
  PYDANTIC_AI = 'pydantic_ai',
  VERCEL_AI = 'vercel_ai',
  // Cloudflare-only: the Workers AI binding (env.AI) auto-instruments once the
  // Worker is wrapped with Sentry.
  WORKERS_AI = 'workers_ai',
  MANUAL = 'manual',
}

export const AGENT_INTEGRATION_LABELS = {
  [AgentIntegration.OPENAI]: 'OpenAI SDK',
  [AgentIntegration.OPENAI_AGENTS]: 'OpenAI Agents SDK',
  [AgentIntegration.ANTHROPIC]: 'Anthropic SDK',
  [AgentIntegration.GOOGLE_GENAI]: 'Google Gen AI SDK',
  [AgentIntegration.LANGCHAIN]: 'LangChain',
  [AgentIntegration.LANGGRAPH]: 'LangGraph',
  [AgentIntegration.LITTELLM]: 'LiteLLM',
  [AgentIntegration.MASTRA]: 'Mastra',
  [AgentIntegration.PYDANTIC_AI]: 'Pydantic AI',
  [AgentIntegration.VERCEL_AI]: 'Vercel AI SDK',
  [AgentIntegration.WORKERS_AI]: 'Workers AI',
  [AgentIntegration.MANUAL]: 'Other',
};

export const AGENT_INTEGRATION_ICONS: Record<AgentIntegration, string> = {
  [AgentIntegration.OPENAI]: 'openai',
  [AgentIntegration.OPENAI_AGENTS]: 'openai',
  [AgentIntegration.ANTHROPIC]: 'anthropic',
  [AgentIntegration.GOOGLE_GENAI]: 'gemini',
  [AgentIntegration.LANGCHAIN]: 'langchain',
  [AgentIntegration.LANGGRAPH]: 'langchain',
  [AgentIntegration.LITTELLM]: 'litellm',
  [AgentIntegration.MASTRA]: 'mastra',
  [AgentIntegration.PYDANTIC_AI]: 'pydantic-ai',
  [AgentIntegration.VERCEL_AI]: 'vercel',
  [AgentIntegration.WORKERS_AI]: 'cloudflare',
  [AgentIntegration.MANUAL]: 'default',
};

export const PYTHON_AGENT_INTEGRATIONS = [
  AgentIntegration.OPENAI,
  AgentIntegration.OPENAI_AGENTS,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.LITTELLM,
  AgentIntegration.PYDANTIC_AI,
  AgentIntegration.MANUAL,
];

/**
 * Every agent SDK offered for Node-based projects, regardless of runtime. The
 * onboarding no longer filters this list by the selected runtime; instead a
 * runtime-specific SDK drives the runtime selection (see
 * INTEGRATION_DEPLOYMENT_TARGETS).
 */
export const NODE_AGENT_INTEGRATIONS = [
  AgentIntegration.VERCEL_AI,
  AgentIntegration.WORKERS_AI,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.MASTRA,
  AgentIntegration.OPENAI,
  AgentIntegration.MANUAL,
];

export const DENO_AGENT_INTEGRATIONS = [
  AgentIntegration.VERCEL_AI,
  AgentIntegration.MANUAL,
];

export const PHP_AGENT_INTEGRATIONS = [AgentIntegration.MANUAL];

/**
 * Where a Node-based project deploys its AI agents. This drives which setup
 * instructions we render in the onboarding empty state (Node runtime vs. the
 * Cloudflare `withSentry` flow).
 */
export enum DeploymentTarget {
  NODE = 'node',
  CLOUDFLARE = 'cloudflare',
}

export const DEPLOYMENT_TARGET_LABELS = {
  [DeploymentTarget.NODE]: 'Node',
  [DeploymentTarget.CLOUDFLARE]: 'Cloudflare',
};

export const DEPLOYMENT_TARGET_ICONS: Record<DeploymentTarget, string> = {
  [DeploymentTarget.NODE]: 'node',
  [DeploymentTarget.CLOUDFLARE]: 'cloudflare',
};

/**
 * Agent SDKs that only work on a single Node deployment runtime. Selecting one
 * of these pins the runtime accordingly (and locks the runtime selector), rather
 * than the runtime filtering which SDKs are shown.
 *
 * - Workers AI is the Cloudflare Workers AI binding (env.AI), Cloudflare-only.
 * - Mastra's `@mastra/sentry` exporter is not part of the Cloudflare `withSentry`
 *   flow, so it is Node-only.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/
 */
export const INTEGRATION_DEPLOYMENT_TARGETS: Partial<
  Record<AgentIntegration, DeploymentTarget>
> = {
  [AgentIntegration.WORKERS_AI]: DeploymentTarget.CLOUDFLARE,
  [AgentIntegration.MASTRA]: DeploymentTarget.NODE,
};

/**
 * Returns the runtime a given SDK is pinned to, or undefined when the SDK works
 * on any runtime and the user is free to pick the deployment target.
 */
export function getIntegrationDeploymentTarget(
  integration: string | undefined
): DeploymentTarget | undefined {
  return integration
    ? INTEGRATION_DEPLOYMENT_TARGETS[integration as AgentIntegration]
    : undefined;
}
