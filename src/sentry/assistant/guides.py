from django.conf import settings

# Guide Schema
# id (text, required): unique id
# required_targets (list): An empty list will cause the guide to be shown regardless
#                          of page/targets presence.
# steps (list): List of steps

# Step Schema
# title (text, required): Title text. Tone should be active.
# message (text, optional): Message text. Should help illustrate how to do a task, not
#                           just literally what the button does.
# target (text, optional): step is tied to an anchor target. If the anchor doesn't exist,
#                          the step will not be shown. if the anchor exists but is of type
#                         "invisible", it will not be pinged but will be scrolled to.
#                          otherwise the anchor will be pinged and scrolled to. If you'd like
#                          your step to show always or have a step is not tied to a specific
#                          element but you'd still like it to be shown, set this as None.

GUIDES = {
    "issue": {"id": 1, "required_targets": ["issue_title", "exception"]},
    "issue_stream": {"id": 3, "required_targets": ["issue_stream"]},
    "inbox_guide": {"id": 8, "required_targets": ["inbox_guide"]},
    "for_review_guide": {"id": 9, "required_targets": ["for_review_guide_tab"]},
    "alerts_write_member": {"id": 10, "required_targets": ["alerts_write_member"]},
    "alerts_write_owner": {"id": 11, "required_targets": ["alerts_write_owner"]},
    "assigned_or_suggested_guide": {"id": 12, "required_targets": ["assigned_or_suggested_query"]},
    "stack_trace_preview": {"id": 15, "required_targets": ["issue_stream_title"]},
    "trace_view": {
        "id": 16,
        "required_targets": ["trace_view_guide_row", "trace_view_guide_row_details"],
    },
    "span_op_breakdowns_and_tag_explorer": {
        "id": 17,
        "required_targets": [
            "span_op_breakdowns_filter",
            "span_op_relative_breakdowns",
            "tag_explorer",
        ],
    },
    "team_key_transactions": {"id": 18, "required_targets": ["team_key_transaction_header"]},
    "project_transaction_threshold": {
        "id": 19,
        "required_targets": ["project_transaction_threshold"],
    },
    "project_transaction_threshold_override": {
        "id": 20,
        "required_targets": ["project_transaction_threshold_override"],
    },
    "percentage_based_alerts": {
        "id": 21,
        "required_targets": ["percentage_based_alerts"],
    },
    "semver": {"id": 22, "required_targets": ["releases_search"]},
    "release_stages": {"id": 23, "required_targets": ["release_stages"]},
}

# demo mode has different guides
if settings.DEMO_MODE:
    GUIDES = {
        "sidebar": {"id": 20, "required_targets": ["projects"]},
        "issue_stream_v2": {"id": 21, "required_targets": ["issue_title"]},
        "issue_v2": {"id": 22, "required_targets": ["issue_details"]},
        "releases": {"id": 23, "required_targets": ["release_version"]},
        "release_details": {"id": 24, "required_targets": ["release_chart"]},
        "discover_landing": {"id": 25, "required_targets": ["discover_landing_header"]},
        "discover_event_view": {"id": 26, "required_targets": ["create_alert_from_discover"]},
        "transaction_details": {"id": 27, "required_targets": ["span_tree"]},
    }
