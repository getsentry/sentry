from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, TypedDict

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
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.rpc_utils import anyvalue_to_python
from sentry.services import eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import json
from sentry.utils.snuba_rpc import table_rpc
from sentry.workflow_engine.models import Detector, Workflow
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

type JSONValue = None | bool | int | float | str | list[JSONValue] | dict[str, JSONValue]
type ArtifactItemType = Literal["workflow", "detector", "group", "event"]


class EvaluationArtifact(TypedDict):
    itemId: str
    traceId: str
    timestamp: str
    projectId: str
    attributes: dict[str, JSONValue]


@dataclass(frozen=True)
class ArtifactTarget:
    """A workflow-engine item and the tenant scope its artifacts are stored under."""

    type: ArtifactItemType
    id: str
    organization: Organization
    project_ids: list[int]
    instance: Workflow | Detector | Group | Event | GroupEvent


@dataclass
class ArtifactQueryResult:
    artifacts: list[EvaluationArtifact]
    truncated: bool


ARTIFACT_LIMIT = 100
CORRELATION_LIMIT = 50


def _organization_project_ids(organization: Organization) -> list[int]:
    return list(
        Project.objects.filter(organization_id=organization.id)
        .order_by("id")
        .values_list("id", flat=True)
    )


def _projectless_detector_organization(detector: Detector) -> Organization:
    # Only issue stream detectors are project-less; they store their organization in config.
    organization_id = detector.config.get("organization_id")
    if (
        detector.type != IssueStreamGroupType.slug
        or not isinstance(organization_id, int)
        or isinstance(organization_id, bool)
    ):
        raise Http404("Detector organization not found")
    try:
        return Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist as error:
        raise Http404("Detector organization not found") from error


def resolve_artifact_target(
    item_type: ArtifactItemType, item_id: str, project: Project | None = None
) -> ArtifactTarget:
    """Look up a validated item and the organization that owns it.

    The caller must authorize `target.organization` before serializing the item or
    querying artifacts. Event lookups take an already-authorized `project`, because
    the eventstore lookup itself can query Snuba.
    """
    instance: Workflow | Detector | Group | Event | GroupEvent
    if item_type == "workflow":
        try:
            # Include hidden and pending-deletion workflows: they may still have artifacts.
            workflow = Workflow.objects_for_deletion.select_related("organization").get(id=item_id)
        except Workflow.DoesNotExist as error:
            raise Http404("Workflow not found") from error
        instance = workflow
        organization = workflow.organization
        project_ids = _organization_project_ids(organization)
    elif item_type == "detector":
        try:
            detector = Detector.objects_for_deletion.select_related("project__organization").get(
                id=item_id
            )
        except Detector.DoesNotExist as error:
            raise Http404("Detector not found") from error
        instance = detector
        if detector.project is not None:
            organization = detector.project.organization
            project_ids = [detector.project.id]
        else:
            organization = _projectless_detector_organization(detector)
            project_ids = _organization_project_ids(organization)
    elif item_type == "group":
        try:
            group = Group.objects.select_related("project__organization").get(id=item_id)
        except Group.DoesNotExist as error:
            raise Http404("Group not found") from error
        instance = group
        organization = group.project.organization
        project_ids = [group.project_id]
    elif item_type == "event":
        if project is None:
            raise ValueError("Event lookup requires a project")
        organization = project.organization
        event = eventstore.backend.get_event_by_id(
            project.id, item_id, tenant_ids={"organization_id": organization.id}
        )
        if event is None:
            raise Http404("Event not found")
        instance = event
        project_ids = [project.id]
    else:
        raise ValueError("Unsupported artifact item type")

    return ArtifactTarget(
        type=item_type,
        id=item_id,
        organization=organization,
        project_ids=project_ids,
        instance=instance,
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
    target: ArtifactTarget,
    start: datetime,
    end: datetime,
    item_filter: TraceItemFilter,
) -> tuple[list[EvaluationArtifact], bool]:
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)
    request = TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=target.organization.id,
            project_ids=target.project_ids,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
            referrer="api.admin.workflow-engine.artifacts",
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
        raise ValueError("No response from workflow-engine artifact query")
    rows = _decode_rows(responses[0])
    truncated = len(rows) > ARTIFACT_LIMIT
    artifacts: list[EvaluationArtifact] = []
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


def query_artifacts(
    target: ArtifactTarget, *, start: datetime, end: datetime
) -> ArtifactQueryResult:
    """Read at most two scoped batches; synthetic traces are not execution IDs.

    Emission is best effort and may be sampled. Artifacts have seven-day retention;
    an empty result is not evidence that the item was never evaluated.
    """
    if not target.project_ids:
        return ArtifactQueryResult(artifacts=[], truncated=False)
    if target.type == "event":
        key = AttributeKey(name="event_id", type=AttributeKey.TYPE_STRING)
        value = AttributeValue(val_str=target.id)
    else:
        key = AttributeKey(name=f"{target.type}_id", type=AttributeKey.TYPE_INT)
        value = AttributeValue(val_int=int(target.id))
    artifacts, truncated = _query_artifact_rows(
        target,
        start,
        end,
        TraceItemFilter(
            comparison_filter=ComparisonFilter(key=key, op=ComparisonFilter.OP_EQUALS, value=value)
        ),
    )
    if target.type != "event":
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
                target,
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
