from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.projectownership import ProjectOwnership


# JSON object representing optional part of API response
class ProjectOwnershipResponseOptional(TypedDict, total=False):
    schema: dict


# JSON object representing this serializer in API response
class ProjectOwnershipResponse(ProjectOwnershipResponseOptional):
    raw: str
    fallthrough: bool
    dateCreated: datetime
    lastUpdated: datetime
    isActive: bool
    autoAssignment: str
    codeownersAutoSync: bool


@register(ProjectOwnership)
class ProjectOwnershipSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> ProjectOwnershipResponse:
        assignment = (
            "Auto Assign to Suspect Commits"
            if obj.auto_assignment and obj.suspect_committer_auto_assignment
            else (
                "Auto Assign to Issue Owner"
                if obj.auto_assignment and not obj.suspect_committer_auto_assignment
                else "Turn off Auto-Assignment"
            )
        )

        project_ownership_data: ProjectOwnershipResponse = {
            "raw": obj.raw,
            "fallthrough": obj.fallthrough,
            "dateCreated": obj.date_created,
            "lastUpdated": obj.last_updated,
            "isActive": obj.is_active,
            "autoAssignment": assignment,
            "codeownersAutoSync": obj.codeowners_auto_sync,
        }
        project_ownership_data["schema"] = obj.schema

        return project_ownership_data
