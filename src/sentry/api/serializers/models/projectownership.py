import copy
from datetime import datetime
from typing import NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.issues.ownership.grammar import OwnershipRuleMatcher
from sentry.models.projectownership import ProjectOwnership


class OwnershipRuleOwnerResponse(TypedDict):
    """Owner as it appears in the API response (after identifier->name rename)."""

    type: str
    name: str
    id: NotRequired[str]


class OwnershipRuleResponse(TypedDict):
    matcher: OwnershipRuleMatcher
    owners: list[OwnershipRuleOwnerResponse]


OwnershipSchemaResponse = TypedDict(
    "OwnershipSchemaResponse", {"$version": int, "rules": list[OwnershipRuleResponse]}
)


# JSON object representing optional part of API response
class ProjectOwnershipResponseOptional(TypedDict, total=False):
    schema: OwnershipSchemaResponse | None


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
        schema = copy.deepcopy(obj.schema)
        if schema and schema.get("rules"):
            for rule in schema["rules"]:
                for owner in rule["owners"]:
                    if "id" in owner:
                        owner["id"] = str(owner["id"])
        project_ownership_data["schema"] = schema

        return project_ownership_data
