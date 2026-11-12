from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from typing import Literal, TypedDict, cast

from django.db.models import Q
from django.http import Http404
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.rpc_utils import anyvalue_to_python
from sentry.services import eventstore
from sentry.utils import json
from sentry.utils.snuba_rpc import table_rpc
from sentry.workflow_engine.endpoints.serializers.action_serializer import ActionSerializer
from sentry.workflow_engine.endpoints.serializers.data_condition_serializer import (
    DataConditionSerializer,
)
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSourceDetector,
    Detector,
    DetectorGroup,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

type JSONValue = None | bool | int | float | str | list[JSONValue] | dict[str, JSONValue]
type DebuggerItemType = Literal["workflow", "detector", "group", "event"]


class DebuggerItem(TypedDict):
    type: DebuggerItemType
    id: str
    organizationId: str
    projectId: str | None
    name: str
    context: dict[str, JSONValue]


class DebuggerArtifact(TypedDict):
    itemId: str
    traceId: str
    timestamp: str
    projectId: str
    attributes: dict[str, JSONValue]


@dataclass
class DebuggerContext:
    organization: Organization
    project_ids: list[int]
    item: DebuggerItem


@dataclass
class ArtifactQueryResult:
    artifacts: list[DebuggerArtifact]
    truncated: bool


RELATED_ITEM_LIMIT = 50
CONFIGURATION_ITEM_LIMIT = 100
ARTIFACT_LIMIT = 100
CORRELATION_LIMIT = 50


def _context_value(value: object) -> JSONValue:
    """Normalize explicit summaries while preserving stored JSON value types."""
    if isinstance(value, Enum):
        return _context_value(value.value)
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, Mapping):
        return {str(name): _context_value(item) for name, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return [_context_value(item) for item in value]
    raise TypeError(f"Unsupported debugger context value: {type(value).__name__}")


def _workflow_summary(workflow: Workflow) -> dict[str, JSONValue]:
    return {
        "id": str(workflow.id),
        "name": workflow.name,
        "type": workflow.type,
        "enabled": workflow.enabled,
        "status": workflow.status,
    }


def _detector_summary(detector: Detector) -> dict[str, JSONValue]:
    return {
        "id": str(detector.id),
        "projectId": str(detector.project_id) if detector.project_id is not None else None,
        "name": detector.name,
        "type": detector.type,
        "enabled": detector.enabled,
        "status": detector.status,
    }


def _group_summary(group: Group) -> dict[str, JSONValue]:
    return {
        "id": str(group.id),
        "projectId": str(group.project_id),
        "title": group.title,
        "status": group.status,
        "substatus": group.substatus,
        "priority": group.priority,
        "type": group.type,
        "platform": group.platform,
        "firstSeen": group.first_seen.isoformat(),
        "lastSeen": group.last_seen.isoformat(),
    }


def _detector_scope(organization_id: int, prefix: str = "") -> Q:
    return Q(**{f"{prefix}project__organization_id": organization_id}) | Q(
        **{
            f"{prefix}project__isnull": True,
            f"{prefix}type": IssueStreamGroupType.slug,
            f"{prefix}config__organization_id": organization_id,
        }
    )


def _condition_groups(
    organization_id: int, group_ids: Sequence[int]
) -> tuple[dict[int, dict[str, JSONValue]], bool]:
    groups = list(
        DataConditionGroup.objects.filter(
            organization_id=organization_id, id__in=group_ids
        ).order_by("id")[: RELATED_ITEM_LIMIT + 1]
    )
    truncated = len(groups) > RELATED_ITEM_LIMIT
    groups = groups[:RELATED_ITEM_LIMIT]
    ids = [group.id for group in groups]
    conditions = list(
        DataCondition.objects.filter(condition_group_id__in=ids).order_by("id")[
            : CONFIGURATION_ITEM_LIMIT + 1
        ]
    )
    actions = list(
        DataConditionGroupAction.objects.filter(condition_group_id__in=ids)
        .select_related("action")
        .order_by("id")[: CONFIGURATION_ITEM_LIMIT + 1]
    )
    truncated |= (
        len(conditions) > CONFIGURATION_ITEM_LIMIT or len(actions) > CONFIGURATION_ITEM_LIMIT
    )
    condition_map: dict[int, list[JSONValue]] = defaultdict(list)
    action_map: dict[int, list[JSONValue]] = defaultdict(list)
    condition_serializer = DataConditionSerializer()
    action_serializer = ActionSerializer()
    for condition in conditions[:CONFIGURATION_ITEM_LIMIT]:
        condition_map[condition.condition_group_id].append(
            _context_value(condition_serializer.serialize(condition))
        )
    for link in actions[:CONFIGURATION_ITEM_LIMIT]:
        action_map[link.condition_group_id].append(
            _context_value(action_serializer.serialize(link.action))
        )
    return {
        group.id: {
            "id": str(group.id),
            "organizationId": str(group.organization_id),
            "logicType": group.logic_type,
            "conditions": condition_map[group.id],
            "actions": action_map[group.id],
        }
        for group in groups
    }, truncated


def _group_relationships(
    group: Group, organization_id: int
) -> tuple[list[JSONValue], list[JSONValue], bool]:
    links = list(
        DetectorGroup.objects.filter(group_id=group.id)
        .filter(_detector_scope(organization_id, "detector__"))
        .select_related("detector")
        .order_by("id")[: RELATED_ITEM_LIMIT + 1]
    )
    detectors = [link.detector for link in links[:RELATED_ITEM_LIMIT] if link.detector is not None]
    workflows = list(
        Workflow.objects_for_deletion.filter(
            organization_id=organization_id,
            detectorworkflow__detector_id__in=[detector.id for detector in detectors],
        )
        .distinct()
        .order_by("id")[: RELATED_ITEM_LIMIT + 1]
    )
    return (
        [_detector_summary(detector) for detector in detectors],
        [_workflow_summary(workflow) for workflow in workflows[:RELATED_ITEM_LIMIT]],
        len(links) > RELATED_ITEM_LIMIT or len(workflows) > RELATED_ITEM_LIMIT,
    )


def resolve_debugger_context(
    item_type: str, item_id: str, project_id: int | None = None
) -> DebuggerContext:
    """Resolve validated IDs after elevated-admin authorization, without an org context.

    The caller must authorize the resolved organization before querying artifacts. Event
    lookup additionally requires authorizing the requested project's organization first,
    because scoped eventstore retrieval can itself issue a Snuba query.
    """
    context: dict[str, JSONValue]
    if item_type == "workflow":
        try:
            workflow = Workflow.objects_for_deletion.select_related(
                "organization", "environment"
            ).get(id=item_id)
        except Workflow.DoesNotExist as error:
            raise Http404("Workflow not found") from error
        organization = workflow.organization
        project_ids = list(
            Project.objects.filter(organization_id=organization.id)
            .order_by("id")
            .values_list("id", flat=True)
        )
        detector_links = list(
            DetectorWorkflow.objects.filter(workflow_id=workflow.id)
            .filter(_detector_scope(organization.id, "detector__"))
            .select_related("detector")
            .order_by("id")[: RELATED_ITEM_LIMIT + 1]
        )
        filter_ids = list(
            WorkflowDataConditionGroup.objects.filter(
                workflow_id=workflow.id, condition_group__organization_id=organization.id
            )
            .order_by("id")
            .values_list("condition_group_id", flat=True)[: RELATED_ITEM_LIMIT + 1]
        )
        filter_limit = RELATED_ITEM_LIMIT - int(workflow.when_condition_group_id is not None)
        group_ids = filter_ids[:filter_limit]
        if workflow.when_condition_group_id is not None:
            group_ids = [workflow.when_condition_group_id, *group_ids]
        groups, configuration_truncated = _condition_groups(organization.id, group_ids)
        context = {
            **_workflow_summary(workflow),
            "dateAdded": workflow.date_added.isoformat(),
            "dateUpdated": workflow.date_updated.isoformat(),
            "createdById": (
                str(workflow.created_by_id) if workflow.created_by_id is not None else None
            ),
            "ownerUserId": (
                str(workflow.owner_user_id) if workflow.owner_user_id is not None else None
            ),
            "ownerTeamId": (
                str(workflow.owner_team_id) if workflow.owner_team_id is not None else None
            ),
            "whenConditionGroupId": (
                str(workflow.when_condition_group_id)
                if workflow.when_condition_group_id is not None
                else None
            ),
            "config": _context_value(workflow.config),
            "environmentId": (
                str(workflow.environment_id) if workflow.environment_id is not None else None
            ),
            "environment": workflow.environment.name if workflow.environment is not None else None,
            "triggers": (
                groups.get(workflow.when_condition_group_id)
                if workflow.when_condition_group_id is not None
                else None
            ),
            "actionFilters": [groups[group_id] for group_id in filter_ids if group_id in groups],
            "detectors": [
                _detector_summary(link.detector) for link in detector_links[:RELATED_ITEM_LIMIT]
            ],
            "projectCount": len(project_ids),
            "contextTruncated": (
                configuration_truncated
                or len(detector_links) > RELATED_ITEM_LIMIT
                or len(filter_ids) > filter_limit
            ),
        }
        name = workflow.name
        resolved_project_id = None
    elif item_type == "detector":
        try:
            detector = Detector.objects_for_deletion.select_related("project__organization").get(
                id=item_id
            )
        except Detector.DoesNotExist as error:
            raise Http404("Detector not found") from error
        if detector.project is not None:
            organization = detector.project.organization
            project_ids = [detector.project.id]
        else:
            organization_id = detector.config.get("organization_id")
            if (
                detector.type != IssueStreamGroupType.slug
                or not isinstance(organization_id, int)
                or isinstance(organization_id, bool)
                or organization_id <= 0
            ):
                raise Http404("Detector organization not found")
            try:
                organization = Organization.objects.get(id=organization_id)
            except Organization.DoesNotExist as error:
                raise Http404("Detector organization not found") from error
            project_ids = list(
                Project.objects.filter(organization_id=organization.id)
                .order_by("id")
                .values_list("id", flat=True)
            )
        workflows = list(
            Workflow.objects_for_deletion.filter(
                organization_id=organization.id, detectorworkflow__detector_id=detector.id
            ).order_by("id")[: RELATED_ITEM_LIMIT + 1]
        )
        group_ids = (
            [detector.workflow_condition_group_id]
            if detector.workflow_condition_group_id is not None
            else []
        )
        groups, configuration_truncated = _condition_groups(organization.id, group_ids)
        latest_links = list(
            DetectorGroup.objects.filter(
                detector_id=detector.id, group__project__organization_id=organization.id
            )
            .select_related("group")
            .order_by("-date_added", "-id")[: RELATED_ITEM_LIMIT + 1]
        )
        sources = list(
            DataSourceDetector.objects.filter(
                detector_id=detector.id, data_source__organization_id=organization.id
            )
            .select_related("data_source")
            .order_by("id")[: RELATED_ITEM_LIMIT + 1]
        )
        project_options: dict[str, JSONValue] = {}
        project_option_sources: dict[str, JSONValue] = {}
        if detector.project_id is not None and detector.type == "error":
            # Match DetectorSerializer's allowlist and stored values, not effective defaults.
            project_options = dict.fromkeys(Detector.error_detector_project_options.values())
            project_option_sources = dict.fromkeys(project_options, "unset")
            for option in ProjectOption.objects.filter(
                project_id=detector.project_id,
                key__in=project_options,
            ):
                project_options[option.key] = _context_value(option.value)
                project_option_sources[option.key] = "project_option"
        context = {
            **_detector_summary(detector),
            "dateAdded": detector.date_added.isoformat(),
            "dateUpdated": detector.date_updated.isoformat(),
            "createdById": (
                str(detector.created_by_id) if detector.created_by_id is not None else None
            ),
            "ownerUserId": (
                str(detector.owner_user_id) if detector.owner_user_id is not None else None
            ),
            "ownerTeamId": (
                str(detector.owner_team_id) if detector.owner_team_id is not None else None
            ),
            "workflowConditionGroupId": (
                str(detector.workflow_condition_group_id)
                if detector.workflow_condition_group_id is not None
                else None
            ),
            "description": detector.description,
            "config": _context_value(detector.config),
            "projectOptions": project_options,
            "projectOptionSources": project_option_sources,
            "conditionGroup": (
                groups.get(detector.workflow_condition_group_id)
                if detector.workflow_condition_group_id is not None
                else None
            ),
            "workflows": [
                _workflow_summary(workflow) for workflow in workflows[:RELATED_ITEM_LIMIT]
            ],
            "latestGroups": [
                _group_summary(link.group) for link in latest_links[:RELATED_ITEM_LIMIT]
            ],
            "dataSources": [
                {
                    "id": str(link.data_source_id),
                    "type": link.data_source.type,
                    "sourceId": str(link.data_source.source_id),
                }
                for link in sources[:RELATED_ITEM_LIMIT]
            ],
            "projectCount": len(project_ids),
            "contextTruncated": (
                configuration_truncated
                or len(workflows) > RELATED_ITEM_LIMIT
                or len(latest_links) > RELATED_ITEM_LIMIT
                or len(sources) > RELATED_ITEM_LIMIT
            ),
        }
        name = detector.name
        resolved_project_id = detector.project_id
    elif item_type == "group":
        try:
            group = Group.objects.select_related("project__organization").get(id=item_id)
        except Group.DoesNotExist as error:
            raise Http404("Group not found") from error
        organization = group.project.organization
        project_ids = [group.project_id]
        group_detectors, group_workflows, truncated = _group_relationships(group, organization.id)
        context = {
            **_group_summary(group),
            "detectors": group_detectors,
            "workflows": group_workflows,
            "contextTruncated": truncated,
        }
        name = group.title
        resolved_project_id = group.project_id
    elif item_type == "event":
        if project_id is None:
            raise ValueError("Event lookup requires a project ID")
        try:
            project = Project.objects.select_related("organization").get(id=project_id)
        except Project.DoesNotExist as error:
            raise Http404("Project not found") from error
        organization = project.organization
        event = eventstore.backend.get_event_by_id(
            project.id, item_id, tenant_ids={"organization_id": organization.id}
        )
        if event is None:
            raise Http404("Event not found")
        project_ids = [project.id]
        event_group = (
            Group.objects.filter(id=event.group_id, project_id=project.id).first()
            if event.group_id is not None
            else None
        )
        event_detectors, event_workflows, truncated = (
            _group_relationships(event_group, organization.id)
            if event_group is not None
            else ([], [], False)
        )
        context = {
            "eventType": event.get_event_type(),
            "platform": event.platform,
            "timestamp": event.datetime.isoformat(),
            "group": _group_summary(event_group) if event_group is not None else None,
            "detectors": event_detectors,
            "workflows": event_workflows,
            "contextTruncated": truncated,
        }
        name = event.title
        resolved_project_id = project.id
    else:
        raise ValueError("Unsupported debugger item type")

    return DebuggerContext(
        organization=organization,
        project_ids=project_ids,
        item={
            "type": cast(DebuggerItemType, item_type),
            "id": item_id,
            "organizationId": str(organization.id),
            "projectId": str(resolved_project_id) if resolved_project_id is not None else None,
            "name": name,
            "context": context,
        },
    )


# The producer stores these as distinct typed attributes. In particular, selecting
# absent booleans/integers must not turn them into false/zero.
_ARTIFACT_ATTRIBUTE_TYPES: dict[str, AttributeKey.Type.ValueType] = {
    **dict.fromkeys(
        (
            "evaluation_type",
            "evaluation_phase",
            "detector_type",
            "event_id",
            "outcome",
            "error",
            "group_key",
            "event_kind",
            "activity_type",
            "trigger_evaluation",
            "filter_evaluations",
            "delayed",
        ),
        AttributeKey.TYPE_STRING,
    ),
    **dict.fromkeys(
        (
            "workflow_id",
            "detector_id",
            "group_id",
            "project_id",
            "priority",
            "issue_status",
            "issue_substatus",
            "issue_priority",
            "environment_id",
        ),
        AttributeKey.TYPE_INT,
    ),
    **dict.fromkeys(
        (
            "triggered",
            "is_resolved",
            "is_new",
            "is_regression",
            "is_new_group_environment",
            "has_escalated",
        ),
        AttributeKey.TYPE_BOOLEAN,
    ),
    "triggered_action_ids": AttributeKey.TYPE_ARRAY_INT,
}
_NATIVE_COLUMNS = (
    Column(label="itemId", key=AttributeKey(name="sentry.item_id", type=AttributeKey.TYPE_STRING)),
    Column(
        label="traceId", key=AttributeKey(name="sentry.trace_id", type=AttributeKey.TYPE_STRING)
    ),
    Column(
        label="timestamp", key=AttributeKey(name="sentry.timestamp", type=AttributeKey.TYPE_DOUBLE)
    ),
    Column(
        label="projectId", key=AttributeKey(name="sentry.project_id", type=AttributeKey.TYPE_INT)
    ),
)
_JSON_ATTRIBUTES = frozenset({"trigger_evaluation", "filter_evaluations", "delayed"})


def _query_artifact_rows(
    context: DebuggerContext,
    start: datetime,
    end: datetime,
    item_filter: TraceItemFilter,
) -> tuple[list[DebuggerArtifact], bool]:
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)
    request = TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=context.organization.id,
            project_ids=context.project_ids,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
            referrer="api.admin.workflow-engine.debugger",
            cogs_category="workflow_engine",
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
            ),
        ),
        columns=[
            *_NATIVE_COLUMNS,
            *(
                Column(label=name, key=AttributeKey(name=name, type=attribute_type))
                for name, attribute_type in _ARTIFACT_ATTRIBUTE_TYPES.items()
            ),
        ],
        filter=item_filter,
        order_by=[
            TraceItemTableRequest.OrderBy(column=_NATIVE_COLUMNS[2], descending=True),
            TraceItemTableRequest.OrderBy(column=_NATIVE_COLUMNS[0], descending=True),
        ],
        limit=ARTIFACT_LIMIT + 1,
    )
    responses = table_rpc([request])
    if not responses:
        raise ValueError("No response from workflow debugger artifact query")
    rows = _decode_rows(responses[0])
    truncated = len(rows) > ARTIFACT_LIMIT
    artifacts: list[DebuggerArtifact] = []
    for row in rows[:ARTIFACT_LIMIT]:
        timestamp = row["timestamp"]
        if not isinstance(timestamp, (int, float)) or isinstance(timestamp, bool):
            raise ValueError("Invalid workflow artifact timestamp")
        attributes: dict[str, JSONValue] = {}
        for name in _ARTIFACT_ATTRIBUTE_TYPES:
            value = row.get(name)
            if value is None:
                continue
            if name in _JSON_ATTRIBUTES and isinstance(value, str):
                try:
                    value = json.loads(value)
                except (ValueError, TypeError):
                    # Retained artifacts can predate the current serialization schema.
                    pass
            attributes[name] = value
        artifacts.append(
            {
                "itemId": str(row["itemId"]),
                "traceId": str(row["traceId"]),
                "timestamp": datetime.fromtimestamp(timestamp, UTC).isoformat(
                    timespec="microseconds"
                ),
                "projectId": str(row["projectId"]),
                "attributes": attributes,
            }
        )
    return artifacts, truncated


def _decode_rows(response: TraceItemTableResponse) -> list[dict[str, JSONValue]]:
    rows: list[dict[str, JSONValue]] = []
    for column in response.column_values:
        while len(rows) < len(column.results):
            rows.append({})
        for index, value in enumerate(column.results):
            kind = value.WhichOneof("value")
            if value.is_null or kind is None or kind == "val_null":
                decoded: JSONValue = None
            elif kind in ("val_str_array", "val_int_array", "val_double_array", "val_float_array"):
                decoded = list(getattr(value, kind).values)
            else:
                decoded = anyvalue_to_python(value)
            rows[index][column.attribute_name] = decoded
    return rows


def query_debugger_artifacts(
    context: DebuggerContext, *, start: datetime, end: datetime
) -> ArtifactQueryResult:
    """Read at most two scoped batches; synthetic traces are not execution IDs.

    Emission is best effort and may be sampled. Artifacts have seven-day retention;
    an empty result is not evidence that the item was never evaluated.
    """
    if not context.project_ids:
        return ArtifactQueryResult(artifacts=[], truncated=False)
    item_type = context.item["type"]
    if item_type == "event":
        key = AttributeKey(name="event_id", type=AttributeKey.TYPE_STRING)
        value = AttributeValue(val_str=context.item["id"])
    else:
        key = AttributeKey(name=f"{item_type}_id", type=AttributeKey.TYPE_INT)
        value = AttributeValue(val_int=int(context.item["id"]))
    artifacts, truncated = _query_artifact_rows(
        context,
        start,
        end,
        TraceItemFilter(
            comparison_filter=ComparisonFilter(key=key, op=ComparisonFilter.OP_EQUALS, value=value)
        ),
    )
    if item_type != "event":
        # Event searches already include all event-backed rows. Other lookups only
        # expand event-backed correlations: eventless traces can span the full period.
        trace_ids = list(
            dict.fromkeys(
                artifact["traceId"]
                for artifact in artifacts
                if artifact["traceId"] and artifact["attributes"].get("event_id")
            )
        )
        truncated |= len(trace_ids) > CORRELATION_LIMIT
        if trace_ids:
            related, related_truncated = _query_artifact_rows(
                context,
                start,
                end,
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name="sentry.trace_id", type=AttributeKey.TYPE_STRING),
                        op=ComparisonFilter.OP_IN,
                        value=AttributeValue(
                            val_str_array=StrArray(values=trace_ids[:CORRELATION_LIMIT])
                        ),
                    )
                ),
            )
            artifacts.extend(related)
            truncated |= related_truncated
    deduplicated = {(artifact["projectId"], artifact["itemId"]): artifact for artifact in artifacts}
    return ArtifactQueryResult(
        artifacts=sorted(
            deduplicated.values(),
            key=lambda artifact: (artifact["timestamp"], artifact["itemId"], artifact["projectId"]),
            reverse=True,
        ),
        truncated=truncated,
    )
