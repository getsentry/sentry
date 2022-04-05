from django.conf import settings

# Guide definitions
#
# The id of each guide should be unique and immutable, as it is stored in the
# AssistantActivity model to record when the guide was seen / dismissed.
#
# Guide UI elements are configured on the frontend in `getGuideContent.tsx`.


GUIDES = {
    "issue": {"id": 1},
    "issue_stream": {"id": 3},
    "alerts_write_member": {"id": 10},
    "alerts_write_owner": {"id": 11},
    "trace_view": {
        "id": 16,
    },
    "span_op_breakdowns_and_tag_explorer": {
        "id": 17,
    },
    "team_key_transactions": {"id": 18},
    "project_transaction_threshold": {
        "id": 19,
    },
    "project_transaction_threshold_override": {
        "id": 20,
    },
    "semver": {"id": 22},
    "release_stages": {"id": 23},
}

# demo mode has different guides
if settings.DEMO_MODE:
    GUIDES = {
        "sidebar": {"id": 20},
        "issue_stream_v2": {"id": 21},
        "issue_v2": {"id": 22},
        "releases": {"id": 23},
        "release_details": {"id": 24},
        "discover_landing": {"id": 25},
        "discover_event_view": {"id": 26},
        "transaction_details": {"id": 27},
    }
