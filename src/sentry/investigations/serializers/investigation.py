from __future__ import annotations

from collections import Counter
from typing import Any

from django.db.models import Count, Prefetch, Q, QuerySet
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.utils.serializer_helpers import ReturnDict

from sentry.api.fields.actor import ActorField
from sentry.api.serializers.rest_framework.base import (
    camel_to_snake_case,
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellComment,
    InvestigationCellDependency,
    InvestigationCellExecutionStatus,
    InvestigationCellKind,
    InvestigationCellParameter,
    InvestigationCellReaction,
    InvestigationCommentReaction,
    InvestigationCommentTeamMention,
    InvestigationCommentUserMention,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationPermissions,
    InvestigationReaction,
    InvestigationStatus,
)


class StrictCamelSnakeSerializer(serializers.Serializer[None]):
    """Camel-case API fields while preserving keys inside JSON objects."""

    def __init__(self, instance: Any = None, data: Any = empty, **kwargs: Any) -> None:
        if isinstance(data, dict):
            converted: dict[str, Any] = {}
            for key, value in data.items():
                converted_key = camel_to_snake_case(key)
                if converted_key in converted:
                    raise serializers.ValidationError(
                        {key: f"{key} collides with {converted_key}; pass only one value."}
                    )
                converted[converted_key] = value
            data = converted
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self) -> ReturnDict[Any, Any]:
        return convert_dict_key_case(super().errors, snake_to_camel_case)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = sorted(set(data) - set(self.fields))
            if unknown:
                raise serializers.ValidationError({field: "Unknown field." for field in unknown})
        return super().to_internal_value(data)


def validate_display(kind: str, display: dict[str, Any]) -> dict[str, Any]:
    display_type = display.get("type")
    if kind == InvestigationCellKind.TEXT:
        if set(display) != {"type"} or display_type != "markdown":
            raise serializers.ValidationError("Text cells must use the markdown display.")
        return display

    if display_type == "table" and set(display) == {"type"}:
        return display
    if display_type not in {"line", "bar", "area"}:
        raise serializers.ValidationError("Query cells must use table, line, bar, or area.")
    if set(display) != {"type", "xAxis", "yAxes"}:
        raise serializers.ValidationError("Charts require exactly type, xAxis, and yAxes.")
    if not isinstance(display["xAxis"], str) or not display["xAxis"]:
        raise serializers.ValidationError("xAxis must be a non-empty string.")
    if (
        not isinstance(display["yAxes"], list)
        or not display["yAxes"]
        or any(not isinstance(axis, str) or not axis for axis in display["yAxes"])
    ):
        raise serializers.ValidationError("yAxes must be a non-empty list of strings.")
    return display


class InvestigationCreateSerializer(StrictCamelSnakeSerializer):
    title = serializers.CharField(max_length=255, required=False)
    template_key = serializers.CharField(max_length=128, required=False)
    template_version = serializers.IntegerField(min_value=1, required=False)
    source_ref = serializers.JSONField(required=False)
    parameters = serializers.JSONField(required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    filters = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        has_key = "template_key" in attrs
        has_version = "template_version" in attrs
        if has_key != has_version:
            raise serializers.ValidationError(
                {"templateKey": "templateKey and templateVersion must be provided together."}
            )
        if has_key:
            if "source_ref" not in attrs:
                raise serializers.ValidationError({"sourceRef": "This field is required."})
            if not isinstance(attrs["source_ref"], dict):
                raise serializers.ValidationError({"sourceRef": "Must be an object."})
            if not isinstance(attrs.get("parameters", {}), dict):
                raise serializers.ValidationError({"parameters": "Must be an object."})
            forbidden = set(attrs).intersection({"project_ids", "filters"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Template creation controls this field." for field in forbidden}
                )
        else:
            if "title" not in attrs:
                raise serializers.ValidationError({"title": "This field is required."})
            forbidden = set(attrs).intersection({"source_ref", "parameters"})
            if forbidden:
                raise serializers.ValidationError(
                    {field: "Requires a template." for field in forbidden}
                )
        project_ids = attrs.get("project_ids", [])
        if len(project_ids) != len(set(project_ids)):
            raise serializers.ValidationError({"projectIds": "Project IDs must be unique."})
        return attrs


class InvestigationUpdateSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=255, required=False)
    status = serializers.ChoiceField(choices=InvestigationStatus.choices, required=False)
    filters = serializers.JSONField(required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)

    def validate_project_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Project IDs must be unique.")
        return value


class InvestigationDeleteSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)


class CellCreateSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    kind = serializers.ChoiceField(choices=InvestigationCellKind.choices)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    generation_prompt = serializers.CharField(required=False, allow_blank=True)
    config = serializers.JSONField(required=False)
    display = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        kind = attrs["kind"]
        display = attrs.get(
            "display",
            {"type": "markdown"} if kind == InvestigationCellKind.TEXT else {"type": "table"},
        )
        if not isinstance(display, dict):
            raise serializers.ValidationError({"display": "Must be an object."})
        attrs["display"] = validate_display(kind, display)
        if not isinstance(attrs.get("config", {}), dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class CellUpdateSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    generation_prompt = serializers.CharField(required=False, allow_blank=True)
    config = serializers.JSONField(required=False)
    display = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "display" in attrs:
            if not isinstance(attrs["display"], dict):
                raise serializers.ValidationError({"display": "Must be an object."})
            attrs["display"] = validate_display(self.context["cell"].kind, attrs["display"])
        if "config" in attrs and not isinstance(attrs["config"], dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class CellDeleteSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)


class CellOrderSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    cell_ids = serializers.ListField(child=serializers.UUIDField())


class ParameterValuesSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    values = serializers.JSONField()

    def validate_values(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value


class PermissionsUpdateSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    is_editable_by_everyone = serializers.BooleanField()
    team_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))

    def validate_team_ids(self, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Team IDs must be unique.")
        return value


class CommentSerializer(StrictCamelSnakeSerializer):
    body = serializers.CharField(max_length=10_000, trim_whitespace=False)
    mentions = serializers.ListField(child=ActorField(), required=False)

    def validate_body(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Comment body cannot be empty.")
        return value


class FavoriteUpdateSerializer(StrictCamelSnakeSerializer):
    should_favorite = serializers.BooleanField()


def serialize_reactions(reactions: Any, user_id: int) -> list[dict[str, Any]]:
    values = (
        [(reaction.reaction, reaction.user_id) for reaction in reactions]
        if isinstance(reactions, list)
        else list(reactions.values_list("reaction", "user_id"))
    )
    counts = Counter(reaction for reaction, _ in values)
    mine = {reaction for reaction, reaction_user_id in values if reaction_user_id == user_id}
    return [
        {
            "reaction": reaction,
            "count": counts[reaction],
            "reactedByMe": reaction in mine,
        }
        for reaction in InvestigationReaction.values
        if reaction in counts
    ]


def serialize_permissions(
    permissions: InvestigationPermissions,
    *,
    user_id: int,
    can_edit: bool | None = None,
    can_manage: bool | None = None,
) -> dict[str, Any]:
    return {
        "isEditableByEveryone": permissions.is_editable_by_everyone,
        "teamIds": sorted(team.id for team in permissions.teams_with_edit_access.all()),
        "canEdit": permissions.has_edit_permissions(user_id) if can_edit is None else can_edit,
        "canManage": (
            user_id == permissions.investigation.created_by_id if can_manage is None else can_manage
        ),
    }


def serialize_parameter(parameter: InvestigationParameter) -> dict[str, Any]:
    return {
        "id": str(parameter.uuid),
        "key": parameter.key,
        "label": parameter.label,
        "description": parameter.description,
        "type": parameter.type,
        "required": parameter.required,
        "constraints": parameter.constraints,
        "defaultValue": parameter.default_value,
        "savedValue": parameter.saved_value,
        "source": parameter.source,
        "position": parameter.position,
        "version": parameter.version,
    }


def serialize_cell(
    cell: InvestigationCell, *, user_id: int, accessible_project_ids: set[int]
) -> dict[str, Any]:
    comment_count = getattr(cell, "active_comment_count", None)
    if comment_count is None:
        comment_count = cell.comments.filter(deleted_at__isnull=True).count()

    execution = cell.current_execution
    if execution is None:
        output = None
        output_status = "notRun"
    else:
        data_project_ids = {project.id for project in execution.data_projects.all()}
        if not data_project_ids.issubset(accessible_project_ids):
            output = None
            output_status = "restricted"
        elif execution.status == InvestigationCellExecutionStatus.COMPLETED:
            output = execution.result
            output_status = "available"
        elif execution.status == InvestigationCellExecutionStatus.FAILED:
            output = None
            output_status = "failed"
        else:
            output = None
            output_status = execution.status

    return {
        "id": str(cell.uuid),
        "position": cell.position,
        "kind": cell.kind,
        "title": cell.title,
        "content": cell.content,
        "generationPrompt": cell.prompt,
        "generatedContent": cell.generated_content,
        "output": output,
        "outputStatus": output_status,
        "config": cell.config,
        "display": cell.display,
        "dependencies": [
            str(link.depends_on.uuid)
            for link in getattr(
                cell,
                "serialized_dependency_links",
                cell.dependency_links.order_by("id").select_related("depends_on"),
            )
        ],
        "parameterKeys": [
            link.parameter.key
            for link in getattr(
                cell,
                "serialized_parameter_links",
                cell.parameter_links.order_by("parameter__position").select_related("parameter"),
            )
        ],
        "version": cell.version,
        "staleAt": cell.stale_at,
        "createdBy": str(cell.created_by_id) if cell.created_by_id is not None else None,
        "lastEditedBy": (
            str(cell.last_edited_by_id) if cell.last_edited_by_id is not None else None
        ),
        "reactions": serialize_reactions(
            getattr(cell, "serialized_reactions", cell.reactions), user_id
        ),
        "commentCount": comment_count,
    }


def serialize_investigation_list(
    investigation: Investigation,
    *,
    user_id: int | None = None,
    can_edit: bool | None = None,
    can_manage: bool | None = None,
) -> dict[str, Any]:
    is_favorited = getattr(investigation, "is_favorited", None)
    if is_favorited is None and user_id is not None:
        is_favorited = InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=user_id
        ).exists()

    active_cell_count = getattr(investigation, "active_cell_count", None)
    if active_cell_count is None:
        active_cell_count = investigation.cells.filter(deleted_at__isnull=True).count()

    data = {
        "id": str(investigation.uuid),
        "title": investigation.title,
        "status": investigation.status,
        "sourceType": investigation.source_type,
        "createdBy": (
            str(investigation.created_by_id) if investigation.created_by_id is not None else None
        ),
        "dateCreated": investigation.date_added,
        "dateUpdated": investigation.date_updated,
        "version": investigation.version,
        "cellCount": active_cell_count,
        "isFavorited": bool(is_favorited),
    }
    if user_id is not None and hasattr(investigation, "permissions"):
        data["permissions"] = serialize_permissions(
            investigation.permissions,
            user_id=user_id,
            can_edit=can_edit,
            can_manage=can_manage,
        )
    return data


def serialize_investigation_detail(
    investigation: Investigation,
    *,
    user_id: int,
    accessible_project_ids: set[int],
    can_edit: bool | None = None,
    can_manage: bool | None = None,
) -> dict[str, Any]:
    permissions, _ = InvestigationPermissions.objects.get_or_create(investigation=investigation)
    cells = (
        InvestigationCell.objects.filter(investigation=investigation, deleted_at__isnull=True)
        .select_related("current_execution")
        .annotate(
            active_comment_count=Count(
                "comments", filter=Q(comments__deleted_at__isnull=True), distinct=True
            )
        )
        .prefetch_related(
            Prefetch(
                "dependency_links",
                queryset=InvestigationCellDependency.objects.select_related("depends_on").order_by(
                    "id"
                ),
                to_attr="serialized_dependency_links",
            ),
            Prefetch(
                "parameter_links",
                queryset=InvestigationCellParameter.objects.select_related("parameter").order_by(
                    "parameter__position"
                ),
                to_attr="serialized_parameter_links",
            ),
            Prefetch(
                "reactions",
                queryset=InvestigationCellReaction.objects.order_by("id"),
                to_attr="serialized_reactions",
            ),
            "current_execution__data_projects",
        )
        .order_by("position", "id")
    )
    return {
        **serialize_investigation_list(
            investigation,
            user_id=user_id,
            can_edit=can_edit,
            can_manage=can_manage,
        ),
        "template": (
            {"key": investigation.template_key, "version": investigation.template_version}
            if investigation.template_key is not None
            else None
        ),
        "source": {"type": investigation.source_type, "ref": investigation.source_ref},
        "filters": investigation.filters,
        "projectIds": list(investigation.projects.order_by("id").values_list("id", flat=True)),
        "permissions": serialize_permissions(
            permissions,
            user_id=user_id,
            can_edit=can_edit,
            can_manage=can_manage,
        ),
        "parameters": [
            serialize_parameter(parameter)
            for parameter in investigation.parameters.order_by("position", "id")
        ],
        "cells": [
            serialize_cell(cell, user_id=user_id, accessible_project_ids=accessible_project_ids)
            for cell in cells
        ],
    }


def serialize_comment(comment: InvestigationCellComment, *, user_id: int) -> dict[str, Any]:
    mentions = [
        {"type": "user", "id": str(mention.user_id)}
        for mention in getattr(
            comment,
            "serialized_user_mentions",
            comment.user_mentions.order_by("user_id"),
        )
    ] + [
        {"type": "team", "id": str(mention.team_id)}
        for mention in getattr(
            comment,
            "serialized_team_mentions",
            comment.team_mentions.order_by("team_id"),
        )
    ]
    return {
        "id": str(comment.uuid),
        "body": None if comment.deleted_at is not None else comment.body,
        "author": str(comment.author_id) if comment.author_id is not None else None,
        "dateCreated": comment.date_added,
        "dateUpdated": comment.date_updated,
        "deletedAt": comment.deleted_at,
        "mentions": [] if comment.deleted_at is not None else mentions,
        "reactions": serialize_reactions(
            getattr(comment, "serialized_reactions", comment.reactions), user_id
        ),
    }


def comments_with_serialization_data(
    queryset: QuerySet[InvestigationCellComment],
) -> QuerySet[InvestigationCellComment]:
    return queryset.prefetch_related(
        Prefetch(
            "user_mentions",
            queryset=InvestigationCommentUserMention.objects.order_by("user_id"),
            to_attr="serialized_user_mentions",
        ),
        Prefetch(
            "team_mentions",
            queryset=InvestigationCommentTeamMention.objects.order_by("team_id"),
            to_attr="serialized_team_mentions",
        ),
        Prefetch(
            "reactions",
            queryset=InvestigationCommentReaction.objects.order_by("id"),
            to_attr="serialized_reactions",
        ),
    )
