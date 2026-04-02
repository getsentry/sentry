import type {Organization} from 'sentry/types/organization';

export type SeerAnalyticsEventsParameters = {
  'ai_query.applied': {
    area: string;
    query: string;
    group_by_count?: number;
    visualize_count?: number;
  };
  'ai_query.error': {
    area: string;
    natural_language_query: string;
  };
  'ai_query.feedback': {
    area: string;
    natural_language_query: string;
    suggested_query: string;
    type: 'positive' | 'negative';
  };
  'ai_query.interface': {
    action: 'opened' | 'closed' | 'consent_accepted';
    area: string;
  };
  'ai_query.rejected': {
    area: string;
    natural_language_query: string;
    num_queries_returned: number;
  };
  'ai_query.submitted': {
    area: string;
    natural_language_query: string;
  };
  'autofix.code_changes.re_run': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.coding_agent.launch': {
    group_id: string;
    organization: Organization;
    provider: string;
    step: 'root_cause' | 'solution';
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.create_pr_clicked': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.root_cause.find_solution': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.root_cause.re_run': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.solution.code': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'autofix.solution.re_run': {
    group_id: string;
    organization: Organization;
    instruction_provided?: boolean;
    mode?: 'explorer' | 'legacy';
    referrer?: string;
  };
  'coding_integration.install_clicked': {
    organization: Organization;
    project_slug: string;
    provider: string;
    source: 'cta' | 'settings';
    user_id: string;
  };
  'coding_integration.send_to_agent_clicked': {
    group_id: string;
    organization: Organization;
    provider: string;
    source: 'autofix' | 'explorer';
    user_id: string;
  };
  'coding_integration.setup_handoff_clicked': {
    organization: Organization;
    project_slug: string;
    provider: string;
    source: 'cta' | 'settings_dropdown' | 'settings_toggle';
    user_id: string;
  };
  'seer.autofix.feedback_submitted': {
    autofix_run_id: string;
    group_id: string;
    positive: boolean;
    step_type: 'root_cause' | 'solution' | 'changes';
    user_id: string;
  };
  'seer.config_reminder.rendered': {
    has_code_review_beta: boolean;
    has_legacy_seer: boolean;
    has_seat_based_seer: boolean;
    initial_step: string;
  };
  'seer.explorer.feedback_submitted': {
    block_index: number;
    block_message: string;
    conversations_url: string | undefined;
    explorer_url: string | undefined;
    langfuse_url: string | undefined;
    run_id: number | undefined;
    type: 'positive' | 'negative';
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
  'seer.explorer.rethink_requested': Record<string, unknown>;
  'seer.explorer.session_copied_to_clipboard': Record<string, unknown>;
  'seer.explorer.session_created': {
    referrer: string;
    surface: 'global_panel';
  };
  'seer.explorer.session_link_copied': Record<string, unknown>;
};

type SeerAnalyticsEventKey = keyof SeerAnalyticsEventsParameters;

export const seerAnalyticsEventsMap: Record<SeerAnalyticsEventKey, string | null> = {
  'ai_query.applied': 'AI Query: Applied',
  'ai_query.error': 'AI Query: Error',
  'ai_query.interface': 'AI Query: Interface',
  'ai_query.rejected': 'AI Query: Rejected',
  'ai_query.submitted': 'AI Query: Submitted',
  'ai_query.feedback': 'AI Query: Feedback',
  'autofix.coding_agent.launch': 'Autofix: Coding Agent Launch',
  'autofix.code_changes.re_run': 'Autofix: Code Changes Re-run',
  'autofix.create_pr_clicked': 'Autofix: Create PR Setup Clicked',
  'autofix.root_cause.find_solution': 'Autofix: Root Cause Find Solution',
  'autofix.root_cause.re_run': 'Autofix: Root Cause Re-run',
  'autofix.solution.code': 'Autofix: Code It Up',
  'autofix.solution.re_run': 'Autofix: Solution Re-run',
  'coding_integration.install_clicked': 'Coding Integration: Install Clicked',
  'coding_integration.send_to_agent_clicked': 'Coding Integration: Send to Agent Clicked',
  'coding_integration.setup_handoff_clicked': 'Coding Integration: Setup Handoff Clicked',
  'seer.autofix.feedback_submitted': 'Seer: Autofix Feedback Submitted',
  'seer.config_reminder.rendered': 'Seer: Config Reminder Rendered',
  'seer.explorer.feedback_submitted': 'Seer Explorer: Feedback Submitted',
  'seer.explorer.global_panel.opened': 'Seer Explorer: Global Panel Opened',
  'seer.explorer.global_panel.tool_link_navigation': 'Seer Explorer: Tool Link Visited',
  'seer.explorer.message_sent': 'Seer Explorer: Message Sent',
  'seer.explorer.session_created': 'Seer Explorer: Session Created',
  'seer.explorer.rethink_requested': 'Seer Explorer: Rethink Requested',
  'seer.explorer.session_copied_to_clipboard':
    'Seer Explorer: Session Copied to Clipboard',
  'seer.explorer.session_link_copied': 'Seer Explorer: Session Link Copied',
};
