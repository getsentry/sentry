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

export const NODE_AGENT_INTEGRATIONS = [
  AgentIntegration.VERCEL_AI,
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
 * Integrations documented for the Cloudflare deployment target. Mirrors the
 * Node list minus Mastra, whose `@mastra/sentry` exporter is not part of the
 * Cloudflare `withSentry` flow.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/
 */
export const CLOUDFLARE_AGENT_INTEGRATIONS = [
  AgentIntegration.VERCEL_AI,
  AgentIntegration.WORKERS_AI,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.OPENAI,
  AgentIntegration.MANUAL,
];
