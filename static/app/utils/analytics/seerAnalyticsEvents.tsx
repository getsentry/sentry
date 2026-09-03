import type {
  PullRequestChecksStatus,
  PullRequestReviewStatus,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

// Pipeline stage a run is bucketed into on the Autofix Overview page. Mirrors
// the `AutofixStateKey` union in the overview view without importing across the
// utils -> views layer boundary.
type AutofixOverviewSection =
  | 'needs_investigation'
  | 'solution_ready'
  | 'code_changes_ready'
  | 'review_pr'
  | 'merged';

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
    /**
     * True when the error occurred while polling/fetching results, false (or
     * absent) when it occurred while starting the search agent.
     */
    is_fetch?: boolean;
    /**
     * HTTP status code of the failed start request. Only available on the
     * start-failure path; absent for polling errors (which have no HTTP status).
     */
    status_code?: number;
  };
  'ai_query.feedback': {
    area: string;
    natural_language_query: string;
    suggested_query: string;
    type: 'positive' | 'negative';
  };
  'ai_query.interface': {
    action: 'opened' | 'closed';
    area: string;
  };
  'ai_query.regenerated': {
    area: string;
    natural_language_query: string;
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
    step: 'root_cause' | 'solution' | 'code_changes';
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
  'autofix.evidence.clicked': {
    group_id: string;
    organization: Organization;
    tool_name: string;
  };
  'autofix.overview.action_clicked': {
    action: 'create_plan' | 'generate_code' | 'draft_pr';
    group_id: string;
    organization: Organization;
    run_id: string;
    section: AutofixOverviewSection;
  };
  'autofix.overview.code_changes_expanded': {
    group_id: string;
    organization: Organization;
    run_id: string;
    section: AutofixOverviewSection;
  };
  'autofix.overview.filter_changed': {
    filter_type: 'sort' | 'assignee' | 'activity' | 'view_tab';
    organization: Organization;
    value: string;
  };
  'autofix.overview.issue_clicked': {
    group_id: string;
    organization: Organization;
    run_id: string;
    section: AutofixOverviewSection;
  };
  'autofix.overview.milestone_advanced': {
    from_milestone: string;
    group_id: string;
    organization: Organization;
    run_id: string;
    to_milestone: string;
  };
  'autofix.overview.open_seer_clicked': {
    group_id: string;
    organization: Organization;
    run_id: string;
    section: AutofixOverviewSection;
  };
  'autofix.overview.pr_clicked': {
    group_id: string;
    organization: Organization;
    run_id: string;
    section: AutofixOverviewSection;
    checks_status?: PullRequestChecksStatus;
    review_status?: PullRequestReviewStatus;
  };
  'autofix.pr_iteration.feedback': {
    group_id: string;
    organization: Organization;
    mode?: 'explorer';
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
    source: 'autofix' | 'explorer' | 'overview';
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
    can_write_settings: boolean;
    has_code_review_beta: boolean;
    has_legacy_seer: boolean;
    has_seat_based_seer: boolean;
  };
  'seer.explorer.block_copied': Record<string, unknown>;
  'seer.explorer.feedback_submitted': {
    block_index: number;
    block_message: string;
    conversations_url: string | undefined;
    explorer_url: string | undefined;
    run_id: SeerExplorerRunId | undefined;
    type: 'positive' | 'negative';
  };
  'seer.explorer.global_panel.opened': {
    referrer: string;
    isDrawer?: boolean;
  };
  'seer.explorer.global_panel.tool_link_navigation': {
    referrer: string;
    tool_kind: string;
  };
  'seer.explorer.message_sent': {
    referrer: string;
    surface: 'global_panel';
  };
  'seer.explorer.session_copied_to_clipboard': Record<string, unknown>;
  'seer.explorer.session_created': {
    referrer: string;
    surface: 'global_panel';
  };
  'seer.explorer.session_link_copied': Record<string, unknown>;
  'seer.explorer.sidebar.position_changed': {
    /** Browser viewport height in CSS pixels, rounded to 50px analytics buckets. */
    browser_height: number;
    /** Browser viewport width in CSS pixels, rounded to 50px analytics buckets. */
    browser_width: number;
    /**
     * Dock preference the user selected, or `pip` when entering document
     * picture-in-picture. Leaving PiP re-emits the restored dock preference.
     */
    position: 'auto' | 'right' | 'bottom' | 'pip';
  };
  'seer.explorer.sidebar.resized': {
    /** Browser viewport height in CSS pixels, rounded to 50px analytics buckets. */
    browser_height: number;
    /** Browser viewport width in CSS pixels, rounded to 50px analytics buckets. */
    browser_width: number;
    /** Resolved dock orientation for the resize (not the auto preference). */
    orientation: 'right' | 'bottom';
    /** Seer pane size in CSS pixels, rounded to 50px analytics buckets. */
    seer_size: number;
    /** Seer pane size as a percent of the available split axis, 0–100. */
    seer_size_percent: number;
  };
  'seer.explorer.timed_out': {
    run_id: SeerExplorerRunId | null;
  };
  'seer.explorer.update_slack_clicked': {
    num_configurations: number;
  };
};

type SeerAnalyticsEventKey = keyof SeerAnalyticsEventsParameters;

export const seerAnalyticsEventsMap: Record<SeerAnalyticsEventKey, string | null> = {
  'ai_query.applied': 'AI Query: Applied',
  'ai_query.error': 'AI Query: Error',
  'ai_query.interface': 'AI Query: Interface',
  'ai_query.regenerated': 'AI Query: Regenerated',
  'ai_query.submitted': 'AI Query: Submitted',
  'ai_query.feedback': 'AI Query: Feedback',
  'autofix.coding_agent.launch': 'Autofix: Coding Agent Launch',
  'autofix.code_changes.re_run': 'Autofix: Code Changes Re-run',
  'autofix.create_pr_clicked': 'Autofix: Create PR Setup Clicked',
  'autofix.evidence.clicked': 'Autofix: Evidence Clicked',
  'autofix.overview.action_clicked': 'Autofix Overview: Action Clicked',
  'autofix.overview.code_changes_expanded': 'Autofix Overview: Code Changes Expanded',
  'autofix.overview.filter_changed': 'Autofix Overview: Filter Changed',
  'autofix.overview.issue_clicked': 'Autofix Overview: Issue Clicked',
  'autofix.overview.milestone_advanced': 'Autofix Overview: Milestone Advanced',
  'autofix.overview.open_seer_clicked': 'Autofix Overview: Open Seer Clicked',
  'autofix.overview.pr_clicked': 'Autofix Overview: PR Clicked',
  'autofix.pr_iteration.feedback': 'Autofix: PR Iteration Feedback',
  'autofix.root_cause.find_solution': 'Autofix: Root Cause Find Solution',
  'autofix.root_cause.re_run': 'Autofix: Root Cause Re-run',
  'autofix.solution.code': 'Autofix: Code It Up',
  'autofix.solution.re_run': 'Autofix: Solution Re-run',
  'coding_integration.install_clicked': 'Coding Integration: Install Clicked',
  'coding_integration.send_to_agent_clicked': 'Coding Integration: Send to Agent Clicked',
  'coding_integration.setup_handoff_clicked': 'Coding Integration: Setup Handoff Clicked',
  'seer.autofix.feedback_submitted': 'Seer: Autofix Feedback Submitted',
  'seer.config_reminder.rendered': 'Seer: Config Reminder Rendered',
  'seer.explorer.block_copied': 'Seer Explorer: Block Content Copied',
  'seer.explorer.feedback_submitted': 'Seer Explorer: Feedback Submitted',
  'seer.explorer.global_panel.opened': 'Seer Explorer: Global Panel Opened',
  'seer.explorer.global_panel.tool_link_navigation': 'Seer Explorer: Tool Link Visited',
  'seer.explorer.message_sent': 'Seer Explorer: Message Sent',
  'seer.explorer.session_created': 'Seer Explorer: Session Created',
  'seer.explorer.session_copied_to_clipboard':
    'Seer Explorer: Session Copied to Clipboard',
  'seer.explorer.session_link_copied': 'Seer Explorer: Session Link Copied',
  'seer.explorer.sidebar.position_changed': 'Seer Explorer: Sidebar Position Changed',
  'seer.explorer.sidebar.resized': 'Seer Explorer: Sidebar Resized',
  'seer.explorer.timed_out': 'Seer Explorer: Timed Out',
  'seer.explorer.update_slack_clicked': 'Seer Explorer: Update Slack Clicked',
};
