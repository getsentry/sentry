import type {AddFeatureProduct} from 'sentry/components/agentHandoff/types';

export type ProductEmptyStateEventParameters = {
  'product_empty_state.agent_setup_command_copied': {
    handoff_id: string;
    platform: string;
    product: AddFeatureProduct;
    project_id: string;
  };
  'product_empty_state.agent_setup_mode_selected': {
    mode: 'agent' | 'manual';
    product: AddFeatureProduct;
    project_id: string;
  };
  'product_empty_state.agent_setup_viewed': {
    platform: string;
    product: AddFeatureProduct;
    project_id: string;
  };
};

export const productEmptyStateEventMap: Record<
  keyof ProductEmptyStateEventParameters,
  string
> = {
  'product_empty_state.agent_setup_command_copied':
    'Product Empty State: Agent Setup Command Copied',
  'product_empty_state.agent_setup_mode_selected':
    'Product Empty State: Agent Setup Mode Selected',
  'product_empty_state.agent_setup_viewed': 'Product Empty State: Agent Setup Viewed',
};
