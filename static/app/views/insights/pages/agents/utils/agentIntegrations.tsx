export enum AgentIntegration {
  OPENAI = 'openai',
  OPENAI_AGENTS = 'openai_agents',
  ANTHROPIC = 'anthropic',
  GOOGLE_GENAI = 'google_genai',
  LANGCHAIN = 'langchain',
  LANGGRAPH = 'langgraph',
  LITTELLM = 'litellm',
  PYDANTIC_AI = 'pydantic_ai',
  VERCEL_AI = 'vercel_ai',
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
  [AgentIntegration.PYDANTIC_AI]: 'Pydantic AI',
  [AgentIntegration.VERCEL_AI]: 'Vercel AI SDK',
  [AgentIntegration.MANUAL]: 'Other',
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
  AgentIntegration.OPENAI,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
  AgentIntegration.MANUAL,
];
