from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.group import DEFAULT_TYPE_ID
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.types import DetectorType


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = DEFAULT_TYPE_ID
    slug = "error"
    description = "Error"
    category = GroupCategory.ERROR.value
    category_v2 = GroupCategory.ERROR.value
    default_priority = PriorityLevel.MEDIUM
    released = True
    detector_type = DetectorType.ERROR
