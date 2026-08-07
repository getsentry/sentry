from __future__ import annotations

from typing import Any

from django.db.models import Prefetch
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.utils.serializer_helpers import ReturnDict

from sentry.api.serializers.rest_framework.base import (
    camel_to_snake_case,
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.investigations.contracts import VisualizationSerializer, validate_query_result
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
    InvestigationBlockParameter,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationPermissions,
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
    if kind == InvestigationBlockKind.TEXT:
        if set(display) == {"type"} and display_type == "markdown":
            return display
        if (
            display_type != "markdown"
            or type(display.get("version")) is not int
            or display["version"] != 1
            or set(display) - {"version", "type", "promptCollapsed"}
            or ("promptCollapsed" in display and not isinstance(display["promptCollapsed"], bool))
        ):
            raise serializers.ValidationError("Text blocks must use the markdown display.")
        return display

    if display_type == "table" and set(display) == {"type"}:
        return display
    if "version" not in display:
        if display_type not in ("line", "bar", "area"):
            raise serializers.ValidationError("Invalid legacy query-block display.")
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

    allowed = {
        "version",
        "type",
        "xAxis",
        "yAxes",
        "seriesField",
        "unit",
        "axisLabel",
        "stacked",
        "showLegend",
        "title",
        "subtitle",
        "sort",
        "topN",
        "defaultView",
        "queryCollapsed",
    }
    if type(display.get("version")) is not int or display["version"] != 1 or set(display) - allowed:
        raise serializers.ValidationError("Invalid versioned query-block display.")
    if display_type not in ("table", "line", "bar", "area"):
        raise serializers.ValidationError("Invalid visualization type.")
    if display.get("defaultView", "table") not in ("table", "chart"):
        raise serializers.ValidationError("defaultView must be table or chart.")
    if "queryCollapsed" in display and not isinstance(display["queryCollapsed"], bool):
        raise serializers.ValidationError("queryCollapsed must be a boolean.")
    if display.get("unit", "number") not in ("number", "percentage", "duration", "bytes"):
        raise serializers.ValidationError("Invalid visualization unit.")
    if display.get("sort", "none") not in ("none", "ascending", "descending"):
        raise serializers.ValidationError("Invalid visualization sort.")
    for field in ("stacked", "showLegend"):
        if field in display and not isinstance(display[field], bool):
            raise serializers.ValidationError(f"{field} must be a boolean.")
    for field in ("title", "subtitle", "seriesField", "axisLabel"):
        if field in display and display[field] is not None and not isinstance(display[field], str):
            raise serializers.ValidationError(f"{field} must be a string or null.")
    if "xAxis" in display and (not isinstance(display["xAxis"], str) or not display["xAxis"]):
        raise serializers.ValidationError("xAxis must be a non-empty string.")
    if "yAxes" in display and (
        not isinstance(display["yAxes"], list)
        or not display["yAxes"]
        or any(not isinstance(axis, str) or not axis for axis in display["yAxes"])
    ):
        raise serializers.ValidationError("yAxes must be a non-empty list of strings.")
    if (
        "topN" in display
        and display["topN"] is not None
        and (
            isinstance(display["topN"], bool)
            or not isinstance(display["topN"], int)
            or not 1 <= display["topN"] <= 20
        )
    ):
        raise serializers.ValidationError("topN must be between 1 and 20.")
    if display_type == "table":
        return display
    if not isinstance(display.get("xAxis"), str) or not display["xAxis"]:
        raise serializers.ValidationError("xAxis must be a non-empty string.")
    if (
        not isinstance(display.get("yAxes"), list)
        or not display.get("yAxes")
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


class BlockCreateSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    kind = serializers.ChoiceField(choices=InvestigationBlockKind.choices)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    generation_prompt = serializers.CharField(required=False, allow_blank=True)
    config = serializers.JSONField(required=False)
    display = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        kind = attrs["kind"]
        display = attrs.get(
            "display",
            (
                {"type": "markdown"}
                if kind == InvestigationBlockKind.TEXT
                else {"version": 1, "type": "table", "defaultView": "table"}
            ),
        )
        if not isinstance(display, dict):
            raise serializers.ValidationError({"display": "Must be an object."})
        attrs["display"] = validate_display(kind, display)
        if not isinstance(attrs.get("config", {}), dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class BlockUpdateSerializer(StrictCamelSnakeSerializer):
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
            attrs["display"] = validate_display(self.context["block"].kind, attrs["display"])
        if "config" in attrs and not isinstance(attrs["config"], dict):
            raise serializers.ValidationError({"config": "Must be an object."})
        return attrs


class BlockDeleteSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)


class BlockExecutionStartSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    version = serializers.IntegerField(min_value=1)
    request_id = serializers.UUIDField(required=False)


class VisualizationSuggestionSerializer(StrictCamelSnakeSerializer):
    current_result = serializers.JSONField()
    visualization = serializers.JSONField()
    requested_change = serializers.CharField(max_length=1000)
    current_intent = serializers.CharField(max_length=10_000)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs["current_result"] = validate_query_result(attrs["current_result"])
        visualization = VisualizationSerializer(data=attrs["visualization"])
        visualization.is_valid(raise_exception=True)
        attrs["visualization"] = dict(visualization.validated_data)
        if not attrs["requested_change"].strip():
            raise serializers.ValidationError(
                {"requestedChange": "Describe the visualization change."}
            )
        return attrs


class BlockOrderSerializer(StrictCamelSnakeSerializer):
    investigation_version = serializers.IntegerField(min_value=1)
    block_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))


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


class FavoriteUpdateSerializer(StrictCamelSnakeSerializer):
    should_favorite = serializers.BooleanField()


def serialize_parameter(parameter: InvestigationParameter) -> dict[str, Any]:
    return {
        "id": str(parameter.id),
        "key": parameter.key,
        "label": parameter.label,
        "description": parameter.description,
        "type": parameter.type,
        "required": parameter.required,
        "constraints": parameter.validation_constraints,
        "defaultValue": parameter.default_value,
        "savedValue": parameter.saved_value,
        "source": parameter.source,
        "position": parameter.position,
        "version": parameter.version,
    }


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


def serialize_block(
    block: InvestigationBlock, *, user_id: int, accessible_project_ids: set[int]
) -> dict[str, Any]:
    execution = block.current_execution
    result_execution = block.result_execution
    content_execution = block.content_execution
    content_restricted = bool(
        block.kind == InvestigationBlockKind.TEXT
        and content_execution is not None
        and not {project.id for project in content_execution.data_projects.all()}.issubset(
            accessible_project_ids
        )
    )
    if execution is None:
        output = None
        output_status = "notRun"
    else:
        visible_execution = (
            result_execution if block.kind == InvestigationBlockKind.QUERY else execution
        )
        data_project_ids = (
            {project.id for project in visible_execution.data_projects.all()}
            if visible_execution is not None
            else set()
        )
        if not data_project_ids.issubset(accessible_project_ids):
            output = None
            output_status = "restricted"
        else:
            output = visible_execution.result if visible_execution is not None else None
            output_status = (
                "available"
                if execution.status == InvestigationBlockExecutionStatus.COMPLETED
                else execution.status
            )
    if content_restricted:
        output = None
        output_status = "restricted"

    content = block.content
    generated_content = block.generated_content
    if block.kind == InvestigationBlockKind.TEXT and output_status == "restricted":
        content = ""
        generated_content = ""

    data = {
        "id": str(block.id),
        "position": block.position,
        "kind": block.kind,
        "title": block.title,
        "content": content,
        "generationPrompt": block.prompt,
        "generatedContent": generated_content,
        "output": output,
        "outputStatus": output_status,
        "currentExecution": (
            {
                "id": str(execution.id),
                "status": execution.status,
                "executor": execution.executor,
                "schemaVersion": execution.result_schema_version,
                "startedAt": execution.started_at,
                "completedAt": execution.completed_at,
                "error": execution.error,
            }
            if execution is not None
            else None
        ),
        "config": block.config,
        "display": block.display,
        "dependencies": [
            str(link.depends_on.id)
            for link in getattr(
                block,
                "serialized_dependency_links",
                block.dependency_links.filter(depends_on__deleted_at__isnull=True)
                .order_by("id")
                .select_related("depends_on"),
            )
        ],
        "parameterKeys": [
            link.parameter.key
            for link in getattr(
                block,
                "serialized_parameter_links",
                block.parameter_links.order_by("parameter__position").select_related("parameter"),
            )
        ],
        "version": block.version,
        "staleAt": block.stale_at,
        "createdBy": str(block.created_by_id) if block.created_by_id is not None else None,
        "lastEditedBy": (
            str(block.last_edited_by_id) if block.last_edited_by_id is not None else None
        ),
    }
    return data


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

    active_block_count = getattr(investigation, "active_block_count", None)
    if active_block_count is None:
        active_block_count = investigation.blocks.filter(deleted_at__isnull=True).count()

    data = {
        "id": str(investigation.id),
        "title": investigation.title,
        "status": investigation.status,
        "sourceType": investigation.source_type,
        "createdBy": (
            str(investigation.created_by_id) if investigation.created_by_id is not None else None
        ),
        "dateCreated": investigation.date_added,
        "dateUpdated": investigation.date_updated,
        "version": investigation.version,
        "blockCount": active_block_count,
        "isFavorited": bool(is_favorited),
    }
    if user_id is not None:
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
    blocks = (
        InvestigationBlock.objects.filter(investigation=investigation, deleted_at__isnull=True)
        .select_related("content_execution", "current_execution", "result_execution")
        .prefetch_related(
            Prefetch(
                "dependency_links",
                queryset=InvestigationBlockDependency.objects.filter(
                    depends_on__deleted_at__isnull=True
                )
                .select_related("depends_on")
                .order_by("id"),
                to_attr="serialized_dependency_links",
            ),
            Prefetch(
                "parameter_links",
                queryset=InvestigationBlockParameter.objects.select_related("parameter").order_by(
                    "parameter__position"
                ),
                to_attr="serialized_parameter_links",
            ),
            "current_execution__data_projects",
            "content_execution__data_projects",
            "result_execution__data_projects",
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
        "source": {
            "type": investigation.source_type,
            "ref": investigation.source_ref,
            "revision": investigation.source_revision,
        },
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
        "blocks": [
            serialize_block(block, user_id=user_id, accessible_project_ids=accessible_project_ids)
            for block in blocks
        ],
        "titleGeneration": {"status": investigation.title_generation_status},
    }
