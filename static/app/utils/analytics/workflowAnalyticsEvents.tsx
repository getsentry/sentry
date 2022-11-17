import type {IssueCategory, ResolutionStatus} from 'sentry/types';
import {Tab} from 'sentry/views/organizationGroupDetails/types';

type RuleViewed = {
  alert_type: 'issue' | 'metric';
  project_id: string;
};

type IssueDetailsWithAlert = {
  group_id: number;
  issue_category: IssueCategory;
  project_id: number;
  /** The time that the alert was initially fired. */
  alert_date?: string;
  /** Id of the rule that triggered the alert */
  alert_rule_id?: string;
  /**  The type of alert notification - email/slack */
  alert_type?: string;
};

export type BaseEventAnalyticsParams = {
  event_id: string;
  has_commit: boolean;
  has_release: boolean;
  has_source_maps: boolean;
  has_trace: boolean;
  num_commits: number;
  num_in_app_stack_frames: number;
  num_stack_frames: number;
  num_threads_with_names: number;
  event_platform?: string;
  event_type?: string;
  sdk_name?: string;
  sdk_version?: string;
};

export type TeamInsightsEventParameters = {
  'alert_builder.filter': {query: string; session_id?: string};
  'alert_details.viewed': {alert_id: number};
  'alert_rule_details.viewed': {alert: string; has_chartcuterie: string; rule_id: number};
  'alert_rules.viewed': {sort: string};
  'alert_stream.viewed': {};
  'alert_wizard.option_selected': {alert_type: string};
  'alert_wizard.option_viewed': {alert_type: string};
  'edit_alert_rule.add_row': {
    name: string;
    project_id: string;
    type: string;
  };
  'edit_alert_rule.viewed': RuleViewed;
  'issue_alert_rule_details.edit_clicked': {rule_id: number};
  'issue_alert_rule_details.viewed': {rule_id: number};
  'issue_details.action_clicked': IssueDetailsWithAlert & {
    action_type:
      | 'deleted'
      | 'mark_reviewed'
      | 'bookmarked'
      | 'subscribed'
      | 'shared'
      | 'discarded'
      | 'open_in_discover'
      | 'assign'
      | ResolutionStatus;
    assigned_suggestion_reason?: string;
  };
  'issue_details.attachment_tab.screenshot_modal_deleted': {};
  'issue_details.attachment_tab.screenshot_modal_download': {};
  'issue_details.attachment_tab.screenshot_modal_opened': {};
  'issue_details.attachment_tab.screenshot_title_clicked': {};
  'issue_details.event_json_clicked': {group_id: number};
  'issue_details.event_navigation_clicked': {button: string; project_id: number};
  'issue_details.issue_tab.screenshot_dropdown_deleted': {};
  'issue_details.issue_tab.screenshot_dropdown_download': {};
  'issue_details.issue_tab.screenshot_modal_deleted': {};
  'issue_details.issue_tab.screenshot_modal_download': {};
  'issue_details.issue_tab.screenshot_modal_opened': {};
  'issue_details.suspect_commits': IssueDetailsWithAlert & {count: number};
  'issue_details.suspect_commits.commit_clicked': IssueDetailsWithAlert & {
    has_pull_request: boolean;
  };
  'issue_details.suspect_commits.pull_request_clicked': IssueDetailsWithAlert;
  'issue_details.tab_changed': IssueDetailsWithAlert & {
    tab: Tab;
  };
  'issue_details.viewed': IssueDetailsWithAlert &
    BaseEventAnalyticsParams & {
      error_count: number;
      error_has_replay: boolean;
      event_errors: string;
      group_has_replay: boolean;
      has_owner: boolean;
      is_assigned: boolean;
      issue_age: number;
      num_comments: number;
      has_external_issue?: boolean;
      integration_assignment_source?: string;
      issue_level?: string;
      issue_status?: string;
      project_has_replay?: boolean;
      project_platform?: string;
    };
  'project_creation_page.created': {
    issue_alert: 'Default' | 'Custom' | 'No Rule';
    project_id: string;
    rule_id: string;
  };
};

export type TeamInsightsEventKey = keyof TeamInsightsEventParameters;

export const workflowEventMap: Record<TeamInsightsEventKey, string | null> = {
  'alert_builder.filter': 'Alert Builder: Filter',
  'alert_details.viewed': 'Alert Details: Viewed',
  'alert_rule_details.viewed': 'Alert Rule Details: Viewed',
  'alert_rules.viewed': 'Alert Rules: Viewed',
  'alert_stream.viewed': 'Alert Stream: Viewed',
  'alert_wizard.option_selected': 'Alert Wizard: Option Selected',
  'alert_wizard.option_viewed': 'Alert Wizard: Option Viewed',
  'edit_alert_rule.add_row': 'Edit Alert Rule: Add Row',
  'edit_alert_rule.viewed': 'Edit Alert Rule: Viewed',
  'issue_alert_rule_details.edit_clicked': 'Issue Alert Rule Details: Edit Clicked',
  'issue_alert_rule_details.viewed': 'Issue Alert Rule Details: Viewed',
  'issue_details.action_clicked': 'Issue Details: Action Clicked',
  'issue_details.attachment_tab.screenshot_title_clicked':
    'Attachment Tab: Screenshot title clicked',
  'issue_details.attachment_tab.screenshot_modal_deleted':
    'Attachment Tab: Screenshot deleted from modal',
  'issue_details.attachment_tab.screenshot_modal_download':
    'Attachment Tab: Screenshot downloaded from modal',
  'issue_details.attachment_tab.screenshot_modal_opened':
    'Attachment Tab: Screenshot modal opened',
  'issue_details.event_json_clicked': 'Issue Details: Event JSON Clicked',
  'issue_details.event_navigation_clicked': 'Issue Details: Event Navigation Clicked',
  'issue_details.issue_tab.screenshot_dropdown_deleted':
    'Issue Details: Screenshot deleted from dropdown',
  'issue_details.issue_tab.screenshot_dropdown_download':
    'Issue Details: Screenshot downloaded from dropdown',
  'issue_details.issue_tab.screenshot_modal_deleted':
    'Issue Details: Screenshot deleted from modal',
  'issue_details.issue_tab.screenshot_modal_download':
    'Issue Details: Screenshot downloaded from modal',
  'issue_details.issue_tab.screenshot_modal_opened':
    'Issue Details: Screenshot modal opened',
  'issue_details.viewed': 'Issue Details: Viewed',
  'issue_details.suspect_commits': 'Issue Details: Suspect Commits',
  'issue_details.suspect_commits.commit_clicked': 'Issue Details: Suspect Commit Clicked',
  'issue_details.suspect_commits.pull_request_clicked':
    'Issue Details: Suspect Pull Request Clicked',
  'issue_details.tab_changed': 'Issue Details: Tab Changed',
  'project_creation_page.created': 'Project Create: Project Created',
};
