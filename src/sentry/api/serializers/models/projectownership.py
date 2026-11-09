from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.issues.ownership.grammar import OwnershipRuleMatcher
from sentry.models.projectownership import ProjectOwnership
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OwnershipRuleOwnerResponse(TypedDict):
    """Owner as it appears in the API response (after identifier->name rename)."""

    type: Annotated[str, ApiDescription("Whether the owner is a user or a team")]
    name: Annotated[str, ApiDescription("Email of the user, or slug of the team")]
    id: NotRequired[
        Annotated[
            str, ApiDescription("ID of the user or team. Only set when the owner was resolved")
        ]
    ]


class OwnershipRuleResponse(TypedDict):
    matcher: Annotated[OwnershipRuleMatcher, ApiDescription("What the rule matches")]
    owners: Annotated[list[OwnershipRuleOwnerResponse], ApiDescription("Owners the rule assigns")]


OwnershipSchemaResponse = TypedDict(
    "OwnershipSchemaResponse",
    {
        "$version": Annotated[int, ApiDescription("Version of the ownership rules schema")],
        "rules": Annotated[
            list[OwnershipRuleResponse], ApiDescription("Ownership rules, in order")
        ],
    },
)


# JSON object representing optional part of API response
class ProjectOwnershipResponseOptional(TypedDict, total=False):
    schema: Annotated[
        OwnershipSchemaResponse | None,
        ApiDescription("Parsed ownership rules. Null when there are no rules"),
    ]


# JSON object representing this serializer in API response
class ProjectOwnershipResponse(ProjectOwnershipResponseOptional):
    raw: Annotated[str | None, ApiDescription("Ownership rules as text")]
    fallthrough: Annotated[
        bool,
        ApiDescription("Whether issues that match no rule are assigned to all project members"),
    ]
    dateCreated: Annotated[
        datetime | None, ApiDescription("When the ownership rules were created (ISO 8601)")
    ]
    lastUpdated: Annotated[
        datetime | None, ApiDescription("When the ownership rules were last updated (ISO 8601)")
    ]
    isActive: Annotated[bool, ApiDescription("Whether the ownership rules are active")]
    autoAssignment: Annotated[
        str,
        ApiDescription(
            "Auto-assignment setting: Auto Assign to Suspect Commits, Auto Assign to Issue Owner or Turn off Auto-Assignment"
        ),
    ]
    codeownersAutoSync: Annotated[
        bool | None, ApiDescription("Whether CODEOWNERS files sync automatically when they change")
    ]


@register(ProjectOwnership)
class ProjectOwnershipSerializer(Serializer[ProjectOwnershipResponse]):
    def serialize(
        self,
        obj: ProjectOwnership,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser | None,
        **kwargs: object,
    ) -> ProjectOwnershipResponse:
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
        if obj.schema and obj.schema.get("rules"):
            for rule in obj.schema["rules"]:
                for owner in rule["owners"]:
                    if "id" in owner:
                        owner["id"] = str(owner["id"])
        project_ownership_data["schema"] = obj.schema

        return project_ownership_data
