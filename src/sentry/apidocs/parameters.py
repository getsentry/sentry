from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers


class GLOBAL_PARAMS:
    ORG_SLUG = OpenApiParameter(
        name="organization_slug",
        description="The slug of the organization the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    PROJECT_SLUG = OpenApiParameter(
        name="project_slug",
        description="The slug of the project the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )


class SCIM_PARAMS:
    MEMBER_ID = OpenApiParameter(
        name="member_id",
        location="path",
        required=True,
        type=int,
        description="The id of the member you'd like to query.",
    )
    TEAM_ID = OpenApiParameter(
        name="team_id",
        location="path",
        required=True,
        type=int,
        description="The id of the team you'd like to query / update.",
    )


class ISSUE_ALERT_PARAMS:
    ISSUE_RULE_ID = OpenApiParameter(
        name="rule_id",
        location="path",
        required=True,
        type=int,
        description="The id of the rule you'd like to query",
    )


class CURSOR_QUERY_PARAM(serializers.Serializer):  # type: ignore
    cursor = serializers.CharField(
        help_text="A pointer to the last object fetched and its' sort order; used to retrieve the next or previous results.",
        required=False,
    )
