from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.workflow_engine.types import DetectorSettings


# hidden group type, used for issue stream detector
@dataclass(frozen=True)
class IssueStreamGroupType(GroupType):
    type_id = -1
    slug = "issue_stream"
    description = "Issue Stream"
    category = GroupCategory.ERROR.value
    released = False
    in_default_search = False
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    enable_user_status_and_priority_changes = False
    detector_settings = DetectorSettings(
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {"organization_id": {"type": "integer"}},
            "additionalProperties": False,
        },
    )
