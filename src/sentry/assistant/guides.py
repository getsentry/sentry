# Guide definitions
#
# The id of each guide should be unique and immutable, as it is stored in the
# AssistantActivity model to record when the guide was seen / dismissed.
#
# Guide UI elements are configured on the frontend in `getGuideContent.tsx`.


GUIDES = {
    "issue": 1,
    "issue_stream": 3,
    "alerts_write_member": 10,
    "alerts_write_owner": 11,
    "trace_view": 16,
    "span_op_breakdowns_and_tag_explorer": 17,
    "team_key_transactions": 18,
    "project_transaction_threshold": 19,
    "project_transaction_threshold_override": 20,
    "semver": 22,
    "release_stages": 23,
    "new_page_filters": 24,
    "new_page_filters_pin": 25,
    "releases_widget": 26,
    "activate_sampling_rule": 27,
    "create_conditional_rule": 28,
    "explain_archive_button_issue_details": 29,
    "explain_archive_tab_issue_stream": 30,
    "explain_new_default_event_issue_detail": 31,
    "new_project_filter": 32,
    "explain_archive_button_issue_stream": 33,
    "ddm_view": 34,
    "metrics_onboarding": 37,
}
