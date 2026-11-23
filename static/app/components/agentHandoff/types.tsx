export enum AgentHandoffFlow {
  CREATE_PROJECT = 'create_project',
  ONBOARDING = 'onboarding',
  ADD_FEATURE = 'add_feature',
}

interface ProjectSetupContext {
  runId: string;
}

export type AddFeatureProduct = 'tracing';

export interface AddFeatureContext {
  product: AddFeatureProduct;
  projectId: string;
}

interface HandoffContexts {
  [AgentHandoffFlow.CREATE_PROJECT]: ProjectSetupContext;
  [AgentHandoffFlow.ONBOARDING]: ProjectSetupContext;
  [AgentHandoffFlow.ADD_FEATURE]: AddFeatureContext;
}

export type AgentHandoffContext<Flow extends AgentHandoffFlow = AgentHandoffFlow> =
  HandoffContexts[Flow];
