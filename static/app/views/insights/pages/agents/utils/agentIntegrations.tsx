import type {PlatformKey} from 'sentry/types/platform';

export enum AgentIntegration {
  OPENAI = 'openai',
  OPENAI_AGENTS = 'openai_agents',
  ANTHROPIC = 'anthropic',
  GOOGLE_GENAI = 'google_genai',
  LANGCHAIN = 'langchain',
  LANGGRAPH = 'langgraph',
  LITELLM = 'litellm',
  // Flue is a TypeScript agent framework (by the Astro team) that ships an
  // official Sentry blueprint. It runs on both Node and Cloudflare.
  FLUE = 'flue',
  MASTRA = 'mastra',
  // Pi Durable, Earendil's durable agent harness (`@earendil-works/pi-durable`).
  // The SDK instruments it automatically on Node, Bun, Deno, and Cloudflare.
  PI = 'pi',
  PYDANTIC_AI = 'pydantic_ai',
  VERCEL_AI = 'vercel_ai',
  // Node-only: Vercel's filesystem-first framework for durable backend AI
  // agents, built on top of the Vercel AI SDK.
  EVE = 'eve',
  // Cloudflare-only: the Workers AI binding (env.AI) auto-instruments once the
  // Worker is wrapped with Sentry.
  WORKERS_AI = 'workers_ai',
  // Cloudflare-only: the Agents SDK, instrumented via instrumentAgentWithSentry.
  CLOUDFLARE_AGENTS = 'cloudflare_agents',
  MANUAL = 'manual',
}

export const AGENT_INTEGRATION_LABELS: Record<AgentIntegration, string> = {
  [AgentIntegration.OPENAI]: 'OpenAI SDK',
  [AgentIntegration.OPENAI_AGENTS]: 'OpenAI Agents SDK',
  [AgentIntegration.ANTHROPIC]: 'Anthropic SDK',
  [AgentIntegration.GOOGLE_GENAI]: 'Google Gen AI SDK',
  [AgentIntegration.LANGCHAIN]: 'LangChain',
  [AgentIntegration.LANGGRAPH]: 'LangGraph',
  [AgentIntegration.LITELLM]: 'LiteLLM',
  [AgentIntegration.FLUE]: 'Flue',
  [AgentIntegration.MASTRA]: 'Mastra',
  [AgentIntegration.PI]: 'Pi Durable',
  [AgentIntegration.PYDANTIC_AI]: 'Pydantic AI',
  [AgentIntegration.VERCEL_AI]: 'Vercel AI SDK',
  [AgentIntegration.EVE]: 'Eve',
  [AgentIntegration.WORKERS_AI]: 'Workers AI',
  [AgentIntegration.CLOUDFLARE_AGENTS]: 'Cloudflare Agents SDK',
  [AgentIntegration.MANUAL]: 'Other',
};

export const AGENT_INTEGRATION_ICONS: Record<AgentIntegration, string> = {
  [AgentIntegration.OPENAI]: 'openai',
  [AgentIntegration.OPENAI_AGENTS]: 'openai',
  [AgentIntegration.ANTHROPIC]: 'anthropic',
  [AgentIntegration.GOOGLE_GENAI]: 'gemini',
  [AgentIntegration.LANGCHAIN]: 'langchain',
  [AgentIntegration.LANGGRAPH]: 'langchain',
  [AgentIntegration.LITELLM]: 'litellm',
  [AgentIntegration.FLUE]: 'flue',
  [AgentIntegration.MASTRA]: 'mastra',
  [AgentIntegration.PI]: 'pi',
  [AgentIntegration.PYDANTIC_AI]: 'pydantic-ai',
  [AgentIntegration.VERCEL_AI]: 'vercel',
  // Eve is a Vercel framework, so it reuses the Vercel icon.
  [AgentIntegration.EVE]: 'vercel',
  [AgentIntegration.WORKERS_AI]: 'cloudflare',
  [AgentIntegration.CLOUDFLARE_AGENTS]: 'cloudflare',
  [AgentIntegration.MANUAL]: 'default',
};

export const PYTHON_AGENT_INTEGRATIONS = [
  AgentIntegration.OPENAI,
  AgentIntegration.OPENAI_AGENTS,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.LITELLM,
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
  AgentIntegration.EVE,
  AgentIntegration.WORKERS_AI,
  AgentIntegration.CLOUDFLARE_AGENTS,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.FLUE,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.MASTRA,
  AgentIntegration.OPENAI,
  AgentIntegration.PI,
  AgentIntegration.MANUAL,
];

/**
 * Bun runs Node packages, so it gets every Node SDK except the Cloudflare-only
 * ones: Bun projects are fixed to the Bun runtime (see PLATFORM_DEPLOYMENT_TARGETS).
 */
export const BUN_AGENT_INTEGRATIONS = NODE_AGENT_INTEGRATIONS.filter(
  integration =>
    integration !== AgentIntegration.WORKERS_AI &&
    integration !== AgentIntegration.CLOUDFLARE_AGENTS
);

/**
 * The agent SDKs the Deno SDK auto-instruments. Cloudflare-only SDKs don't run
 * on Deno, and the Mastra, Flue, and Eve setups are Node-specific.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/deno/agent-tracing/
 */
export const DENO_AGENT_INTEGRATIONS = [
  AgentIntegration.VERCEL_AI,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.OPENAI,
  AgentIntegration.PI,
  AgentIntegration.MANUAL,
];

export const PHP_AGENT_INTEGRATIONS = [AgentIntegration.MANUAL];

/**
 * Where a Node-based project deploys its AI agents. This drives which setup
 * instructions we render in the onboarding empty state (Node runtime vs. the
 * Cloudflare `withSentry` flow). Deno and Bun are only offered to projects
 * whose framework supports them (see PROJECT_DEPLOYMENT_TARGETS).
 */
export enum DeploymentTarget {
  NODE = 'node',
  CLOUDFLARE = 'cloudflare',
  DENO = 'deno',
  BUN = 'bun',
}

export const DEPLOYMENT_TARGET_LABELS: Record<DeploymentTarget, string> = {
  [DeploymentTarget.NODE]: 'Node',
  [DeploymentTarget.CLOUDFLARE]: 'Cloudflare',
  [DeploymentTarget.DENO]: 'Deno',
  [DeploymentTarget.BUN]: 'Bun',
};

export const DEPLOYMENT_TARGET_ICONS: Record<DeploymentTarget, string> = {
  [DeploymentTarget.NODE]: 'node',
  [DeploymentTarget.CLOUDFLARE]: 'cloudflare',
  [DeploymentTarget.DENO]: 'deno',
  [DeploymentTarget.BUN]: 'bun',
};

/**
 * The Sentry SDK package each runtime installs.
 */
export const DEPLOYMENT_TARGET_PACKAGE_NAMES: Record<
  DeploymentTarget,
  `@sentry/${string}`
> = {
  [DeploymentTarget.NODE]: '@sentry/node',
  [DeploymentTarget.CLOUDFLARE]: '@sentry/cloudflare',
  [DeploymentTarget.DENO]: '@sentry/deno',
  [DeploymentTarget.BUN]: '@sentry/bun',
};

/**
 * The module specifier code snippets import a Sentry SDK package from. Deno
 * resolves npm packages through the `npm:` specifier.
 */
export function getSdkImportSpecifier(packageName: `@sentry/${string}`): string {
  return packageName === DEPLOYMENT_TARGET_PACKAGE_NAMES[DeploymentTarget.DENO]
    ? `npm:${packageName}`
    : packageName;
}

/**
 * Project platforms that only run on a single runtime. Their runtime wins over
 * the one an integration is pinned to (see INTEGRATION_DEPLOYMENT_TARGETS).
 */
const PLATFORM_DEPLOYMENT_TARGETS: Partial<Record<PlatformKey, DeploymentTarget>> = {
  'node-cloudflare-workers': DeploymentTarget.CLOUDFLARE,
  deno: DeploymentTarget.DENO,
  bun: DeploymentTarget.BUN,
};

/**
 * Returns the runtime fixed by the project platform, or undefined when the
 * runtime follows the selected integration or the runtime selector.
 */
export function getPlatformDeploymentTarget(
  platform: PlatformKey | null | undefined
): DeploymentTarget | undefined {
  return platform ? PLATFORM_DEPLOYMENT_TARGETS[platform] : undefined;
}

const DEFAULT_DEPLOYMENT_TARGETS = [DeploymentTarget.NODE, DeploymentTarget.CLOUDFLARE];

/**
 * Framework projects that let the user pick the runtime even though the
 * integration is fixed by the project platform.
 */
const PROJECT_DEPLOYMENT_TARGETS: Partial<Record<PlatformKey, DeploymentTarget[]>> = {
  'node-pi-durable': [
    DeploymentTarget.NODE,
    DeploymentTarget.CLOUDFLARE,
    DeploymentTarget.DENO,
    DeploymentTarget.BUN,
  ],
};

/**
 * Returns the runtimes a project picks from, or undefined when the project
 * platform does not offer its own runtime selection.
 */
export function getProjectDeploymentTargets(
  platform: PlatformKey | null | undefined
): DeploymentTarget[] | undefined {
  return platform ? PROJECT_DEPLOYMENT_TARGETS[platform] : undefined;
}

export function getDeploymentTargets(
  platform: PlatformKey | null | undefined
): DeploymentTarget[] {
  return getProjectDeploymentTargets(platform) ?? DEFAULT_DEPLOYMENT_TARGETS;
}

const DEFAULT_AGENT_INTEGRATION_BY_PROJECT_PLATFORM: Partial<
  Record<PlatformKey, AgentIntegration>
> = {
  'node-eve': AgentIntegration.EVE,
  'node-flue': AgentIntegration.FLUE,
  'node-mastra': AgentIntegration.MASTRA,
  'node-pi-durable': AgentIntegration.PI,
};

export function getDefaultAgentIntegration(
  platform: PlatformKey | null | undefined
): AgentIntegration | undefined {
  return platform ? DEFAULT_AGENT_INTEGRATION_BY_PROJECT_PLATFORM[platform] : undefined;
}

/**
 * Agent SDKs that only work on a single Node deployment runtime. Selecting one
 * of these pins the runtime accordingly (and locks the runtime selector), rather
 * than the runtime filtering which SDKs are shown.
 *
 * - Workers AI is the Cloudflare Workers AI binding (env.AI), Cloudflare-only.
 * - The Cloudflare Agents SDK runs only on the Cloudflare runtime.
 * - Mastra's `@mastra/sentry` exporter is not part of the Cloudflare `withSentry`
 *   flow, so it is Node-only.
 * - Eve is a Vercel backend framework that runs on Node, so it is Node-only.
 * - Pi Durable runs on Cloudflare, Deno, and Bun too, but those setups are only
 *   offered in Pi Durable projects (see PROJECT_DEPLOYMENT_TARGETS) and projects
 *   whose platform fixes the runtime (see PLATFORM_DEPLOYMENT_TARGETS). In other
 *   Node projects it is Node-only (see INTEGRATIONS_WITHOUT_DEPLOYMENT_TARGET_SELECTOR).
 *
 * Projects whose platform fixes the runtime ignore these pins.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/
 */
const INTEGRATION_DEPLOYMENT_TARGETS: Partial<
  Record<AgentIntegration, DeploymentTarget>
> = {
  [AgentIntegration.WORKERS_AI]: DeploymentTarget.CLOUDFLARE,
  [AgentIntegration.CLOUDFLARE_AGENTS]: DeploymentTarget.CLOUDFLARE,
  [AgentIntegration.MASTRA]: DeploymentTarget.NODE,
  [AgentIntegration.EVE]: DeploymentTarget.NODE,
  [AgentIntegration.PI]: DeploymentTarget.NODE,
};

/**
 * SDKs pinned to a runtime that hide the runtime selector instead of showing it
 * locked to that runtime.
 */
const INTEGRATIONS_WITHOUT_DEPLOYMENT_TARGET_SELECTOR: ReadonlySet<string> = new Set([
  AgentIntegration.PI,
]);

export function hidesDeploymentTargetSelector(integration: string | undefined): boolean {
  return integration
    ? INTEGRATIONS_WITHOUT_DEPLOYMENT_TARGET_SELECTOR.has(integration)
    : false;
}

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
