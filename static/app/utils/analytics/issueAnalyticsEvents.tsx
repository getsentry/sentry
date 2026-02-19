import type {FieldValue} from 'sentry/components/forms/model';
import type {PriorityLevel} from 'sentry/types/group';
import type {IntegrationType} from 'sentry/types/integrations';
import type {Broadcast} from 'sentry/types/system';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';
import type {CommonGroupAnalyticsData} from 'sentry/utils/events';

type IssueStream = {
  group_id: string;
  was_shown_suggestion: boolean;
};

type ActionableItemDebugParam = {
  type: string;
  group_id?: string;
} & BaseEventAnalyticsParams;

interface GroupEventParams extends CommonGroupAnalyticsData, BaseEventAnalyticsParams {}

interface StreamlineGroupEventParams extends GroupEventParams {
  streamline: boolean;
}
interface StreamlineGroupParams extends CommonGroupAnalyticsData {
  streamline: boolean;
}

interface EventDropdownParams {
  event_id: string;
  from_event_type: string;
  group_id: string;
  selected_event_type: string;
}

interface ExternalIssueParams extends CommonGroupAnalyticsData {
  external_issue_provider: string;
  external_issue_type: IntegrationType;
}

interface SetPriorityParams extends CommonGroupAnalyticsData {
  from_priority: PriorityLevel;
  to_priority: PriorityLevel;
}

export type IssueEventParameters = {
  'actionable_items.expand_clicked': ActionableItemDebugParam;
  'breadcrumbs.drawer.action': {control: string; value?: string};
  'breadcrumbs.issue_details.change_time_display': {value: string};
  'breadcrumbs.issue_details.drawer_opened': {control: string};
  'device.classification.high.end.android.device': {
    processor_count: number;
    processor_frequency: number;
    class?: string;
    family?: string;
    model?: string;
  };
  'device.classification.unclassified.ios.device': {
    model: string;
  };
  'errors.ai_query_applied': {
    query: string;
  };
  'highlights.edit_modal.add_context_key': Record<string, unknown>;
  'highlights.edit_modal.add_tag': Record<string, unknown>;
  'highlights.edit_modal.cancel_clicked': Record<string, unknown>;
  'highlights.edit_modal.remove_context_key': Record<string, unknown>;
  'highlights.edit_modal.remove_tag': Record<string, unknown>;
  'highlights.edit_modal.save_clicked': Record<string, unknown>;
  'highlights.edit_modal.use_default_clicked': Record<string, unknown>;
  'highlights.issue_details.edit_clicked': Record<string, unknown>;
  'highlights.issue_details.view_all_clicked': Record<string, unknown>;
  'highlights.project_settings.updated_manually': Record<string, unknown>;
  'integrations.integration_reinstall_clicked': {
    provider: string;
  };
  'issue-details.replay-cta-dismiss': {type: string};
  'issue.engaged_view': {
    group_id: number;
    issue_type: string;
    project_id: number;
  };
  'issue.list.ai_query_applied': {
    query: string;
  };
  'issue.shared_publicly': Record<string, unknown>;
  'issue_details.activity_drawer.filter_changed': {
    filter: string;
  };
  'issue_details.comment_created': {
    org_streamline_only: boolean | undefined;
    streamline: boolean;
  };
  'issue_details.comment_deleted': {
    org_streamline_only: boolean | undefined;
    streamline: boolean;
  };
  'issue_details.comment_updated': {
    org_streamline_only: boolean | undefined;
    streamline: boolean;
  };
  'issue_details.copy_event_id_clicked': StreamlineGroupEventParams;
  'issue_details.copy_event_link_clicked': StreamlineGroupEventParams;
  'issue_details.copy_issue_details_as_markdown': {
    groupId: string;
    hasAutofix: boolean;
    hasSummary: boolean;
    eventId?: string;
  };
  'issue_details.copy_issue_markdown_link_clicked': StreamlineGroupParams;
  'issue_details.copy_issue_short_id_clicked': StreamlineGroupParams;
  'issue_details.copy_issue_url_clicked': StreamlineGroupParams;
  'issue_details.event_dropdown_option_selected': EventDropdownParams;
  'issue_details.event_navigation_selected': {
    content: string;
  };
  'issue_details.external_issue_created': ExternalIssueParams;
  'issue_details.external_issue_loaded': ExternalIssueParams & {success: boolean};
  'issue_details.external_issue_modal_opened': ExternalIssueParams;
  'issue_details.header_view_replay_clicked': GroupEventParams;
  'issue_details.issue_content_selected': {
    content: string;
  };
  'issue_details.issue_status_docs_clicked': Record<string, unknown>;
  'issue_details.issue_tags_click': Record<string, unknown>;
  'issue_details.related_trace_issue.trace_issue_clicked': {
    group_id: number;
  };
  'issue_details.section_fold': {
    open: boolean;
    org_streamline_only: boolean | undefined;
    sectionKey: string;
  };
  'issue_details.set_priority': SetPriorityParams;
  'issue_details.similar_issues.diff_clicked': {
    error_message?: string;
    group_id?: string;
    parent_group_id?: string;
    project_id?: string;
    shouldBeGrouped?: string;
  };
  'issue_details.similar_issues.similarity_embeddings_feedback_recieved': {
    groupId: string;
    parentGroupId: string;
    value: string;
    projectId?: string;
    wouldGroup?: string;
  };
  'issue_details.streamline_ui_toggle': {
    enforced_streamline_ui: boolean;
    isEnabled: boolean;
  };
  'issue_details.tour.reminder': {method: 'dismissed' | 'timeout'};
  'issue_details.tour.skipped': Record<string, unknown>;
  'issue_details.tour.started': {method: 'dropdown' | 'modal'};
  'issue_details.view_full_trace_waterfall_clicked': Record<string, unknown>;
  'issue_details.view_hierarchy.hover_rendering_system': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_details.view_hierarchy.select_from_tree': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_details.view_hierarchy.select_from_wireframe': {
    platform?: string;
    user_org_role?: string;
  };
  'issue_error_banner.proguard_misconfigured.clicked': {
    group?: string;
    platform?: string;
  };
  'issue_error_banner.proguard_misconfigured.displayed': {
    group?: string;
    platform?: string;
  };
  'issue_error_banner.proguard_missing_mapping.displayed': {
    group?: string;
    platform?: string;
  };
  'issue_group_details.anr_root_cause_detected': {
    culprit?: string;
    group?: string;
  };
  'issue_group_details.tab.clicked': {
    tab: string;
    browser?: string;
    device?: string;
    os?: string;
    platform?: string;
  };
  'issue_group_details.tags.bar.clicked': {
    is_mobile: boolean;
    tag: string;
    value: string;
    platform?: string;
  };
  'issue_search.empty': {
    query: string;
    search_source: string;
    search_type: string;
  };
  'issue_search.failed': {
    error: string;
    search_source: string;
    search_type: string;
  };
  'issue_views.delete_view': {
    ownership: 'personal' | 'organization';
    surface: 'issue-views-list' | 'issue-view-details';
  };
  'issue_views.edit_name': {
    ownership: 'personal' | 'organization';
    surface: 'issue-views-list' | 'issue-view-details';
  };
  'issue_views.new_view.suggested_query_clicked': {
    query: string;
    query_label: string;
  };
  'issue_views.reordered_views': Record<string, unknown>;
  'issue_views.reset.clicked': Record<string, unknown>;
  'issue_views.save.clicked': Record<string, unknown>;
  'issue_views.save_as.clicked': Record<string, unknown>;
  'issue_views.save_as.created': {
    ai_title_shown: boolean;
    ai_title_used: boolean;
    starred: boolean;
    surface: 'issue-view-details' | 'issues-feed' | 'issue-views-list';
  };
  'issue_views.star_view': {
    ownership: 'personal' | 'organization';
    starred: boolean;
    surface: 'issue-views-list' | 'issue-view-details';
  };
  'issue_views.switched_views': Record<string, unknown>;
  'issue_views.table.banner_create_view_clicked': Record<string, unknown>;
  'issue_views.table.create_view_clicked': Record<string, unknown>;
  'issue_views.table.search': {
    query: string;
  };
  'issue_views.table.sort_changed': {
    sort: string;
  };
  'issues_stream.archived': {
    action_status_details?: string;
    action_substatus?: string | null;
  };
  'issues_stream.issue_assigned': IssueStream & {
    assigned_type: string;
    did_assign_suggestion: boolean;
    assigned_suggestion_reason?: string;
  };
  'issues_stream.merged': {
    items_merged: number | 'all_in_query' | undefined;
    platform: string | undefined;
    project_id: string | undefined;
  };
  'issues_stream.paginate': {
    direction: string;
  };
  'issues_stream.realtime_clicked': {
    enabled: boolean;
  };
  'issues_stream.sort_changed': {
    sort: string;
  };
  'issues_stream.updated_priority': {
    priority: PriorityLevel;
  };
  'one_other_related_trace_issue.clicked': {
    area: string;
    // Equivalent to 'issue_details.related_trace_issue.trace_issue_clicked', but `area` is dynamic.
    group_id: number;
  };
  'project_modal.created': {
    issue_alert: 'Default' | 'Custom' | 'No Rule';
    project_id: string;
    rule_id: string;
  };
  'quick_trace.connected_services': {
    projects: number;
  };
  'quick_trace.trace_id.clicked': {
    source: string;
  };
  resolve_issue: {release: string};
  'settings.inbound_filter_updated': {
    filter: string;
    new_state: FieldValue;
    project_id: number;
  };
  'tour-guide.dismiss': {id?: string; step_count?: number; tour_key?: string};
  'tour-guide.finish': {id?: string; step_count?: number; tour_key?: string};
  'tour-guide.open': {id?: string; step_count?: number; tour_key?: string};
  'whats_new.link_clicked': Pick<Broadcast, 'title'> &
    Partial<Pick<Broadcast, 'category'>>;
};

type IssueEventKey = keyof IssueEventParameters;

export const issueEventMap: Record<IssueEventKey, string | null> = {
  'breadcrumbs.issue_details.change_time_display': 'Breadcrumb Time Display Toggled',
  'errors.ai_query_applied': 'Errors: AI Query Applied',
  'breadcrumbs.issue_details.drawer_opened': 'Breadcrumb Drawer Opened',
  'breadcrumbs.drawer.action': 'Breadcrumb Drawer Action Taken',
  'highlights.edit_modal.add_context_key': 'Highlights: Add Context in Edit Modal',
  'highlights.edit_modal.add_tag': 'Highlights: Add Tag in Edit Modal',
  'highlights.edit_modal.cancel_clicked': 'Highlights: Cancel from Edit Modal',
  'highlights.edit_modal.remove_context_key': 'Highlights: Remove Context in Edit Modal',
  'highlights.edit_modal.remove_tag': 'Highlights: Remove Tag in Edit Modal',
  'highlights.edit_modal.save_clicked': 'Highlights: Save from Edit Modal',
  'highlights.edit_modal.use_default_clicked':
    'Highlights: Defaults Applied from Edit Modal',
  'highlights.issue_details.edit_clicked': 'Highlights: Open Edit Modal',
  'highlights.issue_details.view_all_clicked': 'Highlights: View All Clicked',
  'highlights.project_settings.updated_manually':
    'Highlights: Updated Manually from Settings',
  'issue_details.activity_drawer.filter_changed':
    'Issue Details: Activity Drawer Filter Changed',
  'issue_details.copy_issue_short_id_clicked': 'Issue Details: Copy Issue Short ID',
  'issue_details.copy_issue_url_clicked': 'Issue Details: Copy Issue URL',
  'issue_details.copy_issue_markdown_link_clicked':
    'Issue Details: Copy Issue Markdown Link',
  'issue_details.event_navigation_selected': 'Issue Details: Event Navigation Selected',
  'issue_details.issue_content_selected': 'Issue Details: Issue Content Selected',
  'issue_details.issue_tags_click': 'Issue Details: Issue Tags Clicked',
  'issue.engaged_view': 'Issue: Engaged View',
  'issue_details.similar_issues.diff_clicked':
    'Issue Details: Similar Issues: Diff Clicked',
  'issue_details.similar_issues.similarity_embeddings_feedback_recieved':
    'Issue Details: Similar Issues: Similarity Embeddings Feedback Recieved',
  'issue_details.streamline_ui_toggle': 'Streamline: UI Toggle Clicked',
  'issue_details.tour.skipped': 'Issue Details: Tour Skipped',
  'issue_details.tour.started': 'Issue Details: Tour Started',
  'issue_details.tour.reminder': 'Issue Details: Tour Reminder Acknowledged',
  'issue_details.view_hierarchy.hover_rendering_system':
    'View Hierarchy: Hovered rendering system icon',
  'issue_details.view_hierarchy.select_from_tree': 'View Hierarchy: Selection from tree',
  'issue_details.view_hierarchy.select_from_wireframe':
    'View Hierarchy: Selection from wireframe',
  'issue_details.issue_status_docs_clicked': 'Issue Details: Issue Status Docs Clicked',
  'issue_details.related_trace_issue.trace_issue_clicked':
    'Related Issue: Trace Issue Clicked',
  'issue_error_banner.proguard_misconfigured.displayed':
    'Proguard Potentially Misconfigured Issue Error Banner Displayed',
  'issue_error_banner.proguard_missing_mapping.displayed':
    'Proguard Missing Mapping Issue Error Banner Displayed',
  'issue_error_banner.proguard_misconfigured.clicked':
    'Proguard Potentially Misconfigured Issue Error Banner Link Clicked',
  'issue_views.switched_views': 'Issue Views: Switched Views',
  'issue_views.delete_view': 'Issue Views: Delete View',
  'issue_views.reordered_views': 'Issue Views: Views Reordered',
  'issue_views.save_as.clicked': 'Issue Views: Save As Clicked',
  'issue_views.reset.clicked': 'Issue Views: Reset Clicked',
  'issue_views.save_as.created': 'Issue Views: Save As New View Created',
  'issue_views.save.clicked': 'Issue Views: Save Clicked',
  'issue_views.table.sort_changed': 'Issue Views: Changed Sort',
  'issue_views.table.create_view_clicked': 'Issue Views: Create View Clicked',
  'issue_views.table.banner_create_view_clicked':
    'Issue Views: Create View Clicked from No Views Banner',
  'issue_views.new_view.suggested_query_clicked': 'Issue Views: Suggested Query Clicked',
  'issue_views.edit_name': 'Issue Views: Edit Name',
  'issue_views.star_view': 'Issue Views: Star View',
  'issue_search.failed': 'Issue Search: Failed',
  'issue_search.empty': 'Issue Search: Empty',
  'issue.list.ai_query_applied': 'Issue List: AI Query Applied',
  'issues_stream.archived': 'Issues Stream: Archived',
  'issues_stream.updated_priority': 'Issues Stream: Updated Priority',
  'issues_stream.realtime_clicked': 'Issues Stream: Realtime Clicked',
  'issues_stream.issue_assigned': 'Assigned Issue from Issues Stream',
  'issues_stream.merged': 'Merged Issues from Issues Stream',
  'issues_stream.sort_changed': 'Changed Sort on Issues Stream',
  'issues_stream.paginate': 'Paginate Issues Stream',
  'issue.shared_publicly': 'Issue Shared Publicly',
  resolve_issue: 'Resolve Issue',
  'project_modal.created': 'Project Modal: Created',
  'quick_trace.connected_services': 'Quick Trace: Connected Services',
  'quick_trace.trace_id.clicked': 'Quick Trace: Trace ID clicked',
  'settings.inbound_filter_updated': 'Settings: Inbound Filter Updated',
  'issue_group_details.tab.clicked': 'Issue Group Details: Header Tab Clicked',
  'issue_group_details.tags.bar.clicked': 'Issue Group Details: Tags value bar clicked',
  'integrations.integration_reinstall_clicked': 'Integration Reinstall Button Clicked',
  'one_other_related_trace_issue.clicked': 'One Other Related Trace Issue Clicked',
  'issue_details.view_full_trace_waterfall_clicked':
    ' Issue Details: View Full Trace Waterfall Clicked',

  'actionable_items.expand_clicked': 'Actionable Item: Expand Clicked',
  'issue_details.copy_event_link_clicked': 'Issue Details: Copy Event Link Clicked',
  'issue_details.copy_event_id_clicked': 'Issue Details: Copy Event ID Clicked',
  'issue_details.event_dropdown_option_selected':
    'Issue Details: Event Dropdown Option Selected',
  'issue_details.header_view_replay_clicked': 'Issue Details: Header View Replay Clicked',
  'issue-details.replay-cta-dismiss': 'Issue Details Replay CTA Dismissed',
  'issue_group_details.anr_root_cause_detected': 'Detected ANR Root Cause',
  'issue_details.copy_issue_details_as_markdown':
    'Issue Details: Copy Issue Details as Markdown',
  'issue_details.external_issue_loaded': 'Issue Details: External Issue Loaded',
  'issue_details.external_issue_modal_opened':
    'Issue Details: External Issue Modal Opened',
  'issue_details.external_issue_created': 'Issue Details: External Issue Created',
  'device.classification.unclassified.ios.device':
    'Event from iOS device missing device.class',
  'device.classification.high.end.android.device': 'Event from high end Android device',
  'issue_details.set_priority': 'Issue Details: Set Priority',
  'issue_details.section_fold': 'Issue Details: Section Fold',
  'issue_details.comment_created': 'Issue Details: Comment Created',
  'issue_details.comment_deleted': 'Issue Details: Comment Deleted',
  'issue_details.comment_updated': 'Issue Details: Comment Updated',
  'tour-guide.open': 'Tour Guide: Opened',
  'tour-guide.dismiss': 'Tour Guide: Dismissed',
  'tour-guide.finish': 'Tour Guide: Finished',
  'whats_new.link_clicked': "What's New: Link Clicked",
  'issue_views.table.search': 'Issue Views: Table Searched',
};
