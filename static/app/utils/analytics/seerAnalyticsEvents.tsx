import type {Organization} from 'sentry/types/organization';

export type SeerAnalyticsEventsParameters = {
  'autofix.coding_agent.launch_from_root_cause': {
    group_id: string;
    organization: Organization;
  };
  'autofix.root_cause.find_solution': {
    group_id: string;
    instruction_provided: boolean;
    organization: Organization;
  };
  'autofix.setup_modal_viewed': {
    groupId: string;
    projectId: string;
    setup_gen_ai_consent: boolean;
    setup_integration: boolean;
    setup_write_integration?: boolean;
  };
  'seer.autofix.feedback_submitted': {
    autofix_run_id: string;
    group_id: string;
    positive: boolean;
    step_type: 'root_cause' | 'solution' | 'changes';
    user_id: string;
  };
  'seer.explorer.global_panel.opened': {
    referrer: string;
  };
  'seer.explorer.global_panel.tool_link_navigation': {
    referrer: string;
    tool_kind: string;
  };
  'seer.explorer.message_sent': {
    referrer: string;
    surface: 'global_panel';
  };
  'seer.explorer.session_rethink_request': Record<string, unknown>;
  'seer.explorer.session_started': {
    referrer: string;
    surface: 'global_panel';
  };
};

type SeerAnalyticsEventKey = keyof SeerAnalyticsEventsParameters;

export const seerAnalyticsEventsMap: Record<SeerAnalyticsEventKey, string | null> = {
  'autofix.coding_agent.launch_from_root_cause':
    'Autofix: Coding Agent Launch From Root Cause',
  'autofix.root_cause.find_solution': 'Autofix: Root Cause Find Solution',
  'autofix.setup_modal_viewed': 'Autofix: Setup Modal Viewed',
  'seer.autofix.feedback_submitted': 'Seer: Autofix Feedback Submitted',
  'seer.explorer.global_panel.opened': 'Seer Explorer: Global Panel Opened',
  'seer.explorer.global_panel.tool_link_navigation': 'Seer Explorer: Tool Link Visited',
  'seer.explorer.message_sent': 'Seer Explorer: Message Sent',
  'seer.explorer.session_started': 'Seer Explorer: Session Started',
  'seer.explorer.session_rethink_request': 'Seer Explorer: Rethink Triggered',
};
