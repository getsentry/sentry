from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, NotRequired, TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery
from django.db.models.functions import TruncHour

from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.rules.actions.notify_event_service import PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS
from sentry.rules.history.base import TimeSeriesValue
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.models.data_condition_group_action import DataConditionGroupAction
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.types import ActionHandler, DataConditionHandler, DataSourceTypeHandler


class ActionSerializerResponse(TypedDict):
    id: str
    type: str
    integrationId: str | None
    data: dict
    config: dict


@register(Action)
class ActionSerializer(Serializer):
    def serialize(self, obj: Action, *args, **kwargs) -> ActionSerializerResponse:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "integrationId": str(obj.integration_id) if obj.integration_id else None,
            "data": obj.data,
            "config": obj.config,
        }


class SentryAppContext(TypedDict):
    id: str
    name: str
    installationId: str
    installationUuid: str
    status: int
    settings: NotRequired[dict[str, Any]]
    title: NotRequired[str]


class ActionHandlerSerializerResponse(TypedDict):
    type: str
    handlerGroup: str
    configSchema: dict
    dataSchema: dict
    sentryApp: NotRequired[SentryAppContext]
    integrations: NotRequired[list]
    services: NotRequired[list]


@register(ActionHandler)
class ActionHandlerSerializer(Serializer):
    def transform_title(self, title: str) -> str:
        if title in PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS:
            return f"(Legacy) {title}"
        return title

    def serialize(
        self,
        obj: ActionHandler,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> ActionHandlerSerializerResponse:
        action_type = kwargs.get("action_type")
        if action_type is None:
            raise ValueError("action_type is required")

        result: ActionHandlerSerializerResponse = {
            "type": action_type,
            "handlerGroup": obj.group.value,
            "configSchema": obj.config_schema,
            "dataSchema": obj.data_schema,
        }

        integrations = kwargs.get("integrations")
        if integrations:
            integrations_result = []
            for i in integrations:
                i_result = {"id": str(i["integration"].id), "name": i["integration"].name}
                if i["services"]:
                    i_result["services"] = [
                        {"id": str(id), "name": name} for id, name in i["services"]
                    ]
                integrations_result.append(i_result)
            result["integrations"] = integrations_result

        sentry_app_context = kwargs.get("sentry_app_context")
        if sentry_app_context:
            installation = sentry_app_context.installation
            component = sentry_app_context.component
            sentry_app: SentryAppContext = {
                "id": str(installation.sentry_app.id),
                "name": installation.sentry_app.name,
                "installationId": str(installation.id),
                "installationUuid": str(installation.uuid),
                "status": installation.sentry_app.status,
            }
            if component:
                prepared_component = prepare_ui_component(
                    installation=installation,
                    component=component,
                    project_slug=None,
                    values=None,
                )
                if prepared_component:
                    sentry_app["settings"] = prepared_component.app_schema.get("settings", {})
                    if prepared_component.app_schema.get("title"):
                        sentry_app["title"] = prepared_component.app_schema.get("title")
            result["sentryApp"] = sentry_app

        services = kwargs.get("services")
        if services:
            services_list = [
                {"slug": service.slug, "name": self.transform_title(service.title)}
                for service in services
            ]
            services_list.sort(key=lambda x: x["name"])
            result["services"] = services_list

        return result


@register(DataSource)
class DataSourceSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataSource], user: Any, **kwargs: Any
    ) -> MutableMapping[DataSource, dict[str, Any]]:
        attrs: dict[DataSource, dict[str, Any]] = defaultdict(dict)
        ds_by_type: dict[type[DataSourceTypeHandler], list[DataSource]] = defaultdict(list)
        for item in item_list:
            ds_by_type[item.type_handler].append(item)

        serialized_query_objs: dict[int, dict[str, Any]] = {}

        for type_handler, ds_items in ds_by_type.items():
            ds_query_objs = list(type_handler.bulk_get_query_object(ds_items).items())
            serialized: list[dict[str, Any]] = serialize(
                [query_obj for ds, query_obj in ds_query_objs], user=user
            )
            serialized_query_objs.update(
                {
                    ds_id: serialized_obj
                    for (ds_id, query_obj), serialized_obj in zip(ds_query_objs, serialized)
                }
            )
        for item in item_list:
            attrs[item]["query_obj"] = serialized_query_objs.get(item.id, [])

        return attrs

    def serialize(
        self, obj: DataSource, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "type": obj.type,
            "sourceId": str(obj.source_id),
            "queryObj": attrs["query_obj"],
        }


@register(DataCondition)
class DataConditionSerializer(Serializer):
    def serialize(self, obj: DataCondition, *args, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "comparison": obj.comparison,
            "conditionResult": obj.condition_result,
        }


@register(DataConditionGroup)
class DataConditionGroupSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DataConditionGroup], user, **kwargs
    ) -> MutableMapping[DataConditionGroup, dict[str, Any]]:
        attrs: MutableMapping[DataConditionGroup, dict[str, Any]] = defaultdict(dict)
        conditions = defaultdict(list)

        condition_list = list(DataCondition.objects.filter(condition_group__in=item_list))

        for condition, serialized in zip(condition_list, serialize(condition_list, user=user)):
            conditions[condition.condition_group_id].append(serialized)

        dcga_list = list(DataConditionGroupAction.objects.filter(condition_group__in=item_list))
        actions = {dcga.action for dcga in dcga_list}

        serialized_actions = {
            action.id: serialized
            for action, serialized in zip(actions, serialize(actions, user=user))
        }
        action_map = defaultdict(list)
        for dcga in dcga_list:
            action_map[dcga.condition_group_id].append(serialized_actions[dcga.action_id])

        for item in item_list:
            attrs[item]["conditions"] = conditions.get(item.id, [])
            attrs[item]["actions"] = action_map.get(item.id, [])
        return attrs

    def serialize(
        self, obj: DataConditionGroup, attrs: Mapping[str, Any], user, **kwargs
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "logicType": obj.logic_type,
            "conditions": attrs.get("conditions"),
            "actions": attrs.get("actions"),
        }


class DataConditionHandlerResponse(TypedDict):
    type: str
    handlerGroup: str
    handlerSubgroup: NotRequired[str]
    comparisonJsonSchema: dict


@register(DataConditionHandler)
class DataConditionHandlerSerializer(Serializer):
    def serialize(
        self,
        obj: DataConditionHandler,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> DataConditionHandlerResponse:
        condition_type = kwargs.get("condition_type")
        if condition_type is None:
            raise ValueError("condition_type is required")
        result: DataConditionHandlerResponse = {
            "type": condition_type,
            "handlerGroup": obj.group.value,
            "comparisonJsonSchema": obj.comparison_json_schema,
        }
        if hasattr(obj, "subgroup"):
            result["handlerSubgroup"] = obj.subgroup.value
        return result


@register(Detector)
class DetectorSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Detector], user, **kwargs
    ) -> MutableMapping[Detector, dict[str, Any]]:
        attrs: MutableMapping[Detector, dict[str, Any]] = defaultdict(dict)

        dsd_list = list(
            DataSourceDetector.objects.filter(detector__in=item_list).select_related("data_source")
        )
        data_sources = {dsd.data_source for dsd in dsd_list}
        serialized_data_sources = {
            ds.id: serialized
            for ds, serialized in zip(data_sources, serialize(data_sources, user=user))
        }
        ds_map = defaultdict(list)
        for dsd in dsd_list:
            ds_map[dsd.detector_id].append(serialized_data_sources[dsd.data_source_id])

        condition_groups = list(
            DataConditionGroup.objects.filter(
                id__in=[
                    d.workflow_condition_group_id
                    for d in item_list
                    if d.workflow_condition_group_id
                ]
            )
        )
        condition_group_map = {
            str(group.id): serialized
            for group, serialized in zip(condition_groups, serialize(condition_groups, user=user))
        }

        workflows_map = defaultdict(list)
        detector_workflows = DetectorWorkflow.objects.filter(detector__in=item_list).values_list(
            "detector_id", "workflow_id"
        )
        for detector_id, workflow_id in detector_workflows:
            workflows_map[detector_id].append(str(workflow_id))

        filtered_item_list = [item for item in item_list if item.type == ErrorGroupType.slug]
        project_ids = [item.project_id for item in filtered_item_list]

        project_options_list = list(
            ProjectOption.objects.filter(
                key__in=Detector.error_detector_project_options.values(), project__in=project_ids
            )
        )

        configs: dict[int, dict[str, Any]] = defaultdict(
            dict
        )  # make the config for Error Detectors
        for option in project_options_list:
            configs[option.project_id][option.key] = option.value

        for item in item_list:
            attrs[item]["data_sources"] = ds_map.get(item.id)
            attrs[item]["condition_group"] = condition_group_map.get(
                str(item.workflow_condition_group_id)
            )
            attrs[item]["workflow_ids"] = workflows_map[item.id]
            if item.id in configs:
                attrs[item]["config"] = configs[item.id]
            else:
                attrs[item]["config"] = item.config
            actor = item.owner
            if actor:
                attrs[item]["owner"] = actor.identifier

        return attrs

    def serialize(self, obj: Detector, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "name": obj.name,
            "type": obj.type,
            "workflowIds": attrs.get("workflow_ids"),
            "owner": attrs.get("owner"),
            "createdBy": str(obj.created_by_id) if obj.created_by_id else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dataSources": attrs.get("data_sources"),
            "conditionGroup": attrs.get("condition_group"),
            "config": attrs.get("config"),
            "enabled": obj.enabled,
        }


@register(Workflow)
class WorkflowSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs) -> MutableMapping[Workflow, dict[str, Any]]:
        attrs: MutableMapping[Workflow, dict[str, Any]] = defaultdict(dict)
        trigger_conditions = list(
            DataConditionGroup.objects.filter(
                id__in=[w.when_condition_group_id for w in item_list if w.when_condition_group_id]
            )
        )
        trigger_condition_map = {
            group.id: serialized
            for group, serialized in zip(
                trigger_conditions, serialize(trigger_conditions, user=user)
            )
        }

        wdcg_list = list(WorkflowDataConditionGroup.objects.filter(workflow__in=item_list))
        condition_groups = {wdcg.condition_group for wdcg in wdcg_list}

        serialized_condition_groups = {
            dcg.id: serialized
            for dcg, serialized in zip(condition_groups, serialize(condition_groups, user=user))
        }
        dcg_map = defaultdict(list)
        for wdcg in wdcg_list:
            dcg_map[wdcg.workflow_id].append(serialized_condition_groups[wdcg.condition_group_id])

        detectors_map = defaultdict(list)
        detector_workflows = DetectorWorkflow.objects.filter(workflow__in=item_list).values_list(
            "detector_id", "workflow_id"
        )
        for detector_id, workflow_id in detector_workflows:
            detectors_map[workflow_id].append(str(detector_id))

        for item in item_list:
            attrs[item]["triggers"] = trigger_condition_map.get(
                item.when_condition_group_id
            )  # when condition group
            attrs[item]["actionFilters"] = dcg_map.get(
                item.id, []
            )  # The data condition groups for filtering actions
            attrs[item]["detectorIds"] = detectors_map[item.id]
        return attrs

    def serialize(self, obj: Workflow, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "name": str(obj.name),
            "organizationId": str(obj.organization_id),
            "createdBy": str(obj.created_by_id) if obj.created_by_id else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "triggers": attrs.get("triggers"),
            "actionFilters": attrs.get("actionFilters"),
            "environment": obj.environment.name if obj.environment else None,
            "config": obj.config,
            "detectorIds": attrs.get("detectorIds"),
            "enabled": obj.enabled,
        }


@dataclass(frozen=True)
class WorkflowGroupHistory:
    group: Group
    count: int
    last_triggered: datetime
    event_id: str
    detector: Detector | None


class WorkflowFireHistoryResponse(TypedDict):
    group: BaseGroupSerializerResponse
    count: int
    lastTriggered: datetime
    eventId: str
    detector: NotRequired[dict[str, Any]]


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime
    event_id: str
    detector_id: int | None


def convert_results(results: Sequence[_Result]) -> Sequence[WorkflowGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}

    detector_ids = [r["detector_id"] for r in results if r["detector_id"] is not None]
    detector_lookup = {}
    if detector_ids:
        detector_lookup = {d.id: d for d in Detector.objects.filter(id__in=detector_ids)}

    return [
        WorkflowGroupHistory(
            group=group_lookup[r["group"]],
            count=r["count"],
            last_triggered=r["last_triggered"],
            event_id=r["event_id"],
            detector=(
                detector_lookup.get(r["detector_id"]) if r["detector_id"] is not None else None
            ),
        )
        for r in results
    ]


def fetch_workflow_groups_paginated(
    workflow: Workflow,
    start: datetime,
    end: datetime,
    cursor: Cursor | None = None,
    per_page: int = 25,
) -> CursorResult[Group]:
    filtered_history = WorkflowFireHistory.objects.filter(
        workflow=workflow,
        date_added__gte=start,
        date_added__lt=end,
    )

    # subquery that retrieves row with the largest date in a group
    group_max_dates = filtered_history.filter(group=OuterRef("group")).order_by("-date_added")[:1]
    qs = (
        filtered_history.select_related("group", "detector")
        .values("group")
        .annotate(count=Count("group"))
        .annotate(event_id=Subquery(group_max_dates.values("event_id")))
        .annotate(last_triggered=Max("date_added"))
        .annotate(detector_id=Subquery(group_max_dates.values("detector_id")))
    )

    return cast(
        CursorResult[Group],
        OffsetPaginator(
            qs, order_by=("-count", "-last_triggered"), on_results=convert_results
        ).get_result(per_page, cursor),
    )


def fetch_workflow_hourly_stats(
    workflow: Workflow, start: datetime, end: datetime
) -> Sequence[TimeSeriesValue]:
    start = start.replace(tzinfo=timezone.utc)
    end = end.replace(tzinfo=timezone.utc)
    qs = (
        WorkflowFireHistory.objects.filter(
            workflow=workflow,
            date_added__gte=start,
            date_added__lt=end,
        )
        .annotate(bucket=TruncHour("date_added"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    existing_data = {row["bucket"]: TimeSeriesValue(row["bucket"], row["count"]) for row in qs}

    results = []
    current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    while current <= end.replace(minute=0, second=0, microsecond=0):
        results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
        current += timedelta(hours=1)
    return results


class WorkflowGroupHistorySerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[WorkflowGroupHistory], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        serialized_groups = {
            g["id"]: g for g in serialize([item.group for item in item_list], user)
        }

        # Get detectors that are not None
        detectors = [item.detector for item in item_list if item.detector is not None]
        serialized_detectors = {}
        if detectors:
            serialized_detectors = {
                str(d.id): serialized
                for d, serialized in zip(detectors, serialize(detectors, user))
            }

        attrs = {}
        for history in item_list:
            item_attrs = {"group": serialized_groups[str(history.group.id)]}
            if history.detector:
                item_attrs["detector"] = serialized_detectors[str(history.detector.id)]

            attrs[history] = item_attrs

        return attrs

    def serialize(
        self, obj: WorkflowGroupHistory, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> WorkflowFireHistoryResponse:
        result: WorkflowFireHistoryResponse = {
            "group": attrs["group"],
            "count": obj.count,
            "lastTriggered": obj.last_triggered,
            "eventId": obj.event_id,
        }

        if "detector" in attrs:
            result["detector"] = attrs["detector"]

        return result


class TimeSeriesValueResponse(TypedDict):
    date: datetime
    count: int


class TimeSeriesValueSerializer(Serializer):
    def serialize(
        self, obj: TimeSeriesValue, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> TimeSeriesValueResponse:
        return {
            "date": obj.bucket,
            "count": obj.count,
        }


class DetectorWorkflowResponse(TypedDict):
    id: str
    detectorId: str
    workflowId: str


@register(DetectorWorkflow)
class DetectorWorkflowSerializer(Serializer):
    def serialize(
        self, obj: DetectorWorkflow, attrs: Mapping[str, Any], user, **kwargs
    ) -> DetectorWorkflowResponse:
        return {
            "id": str(obj.id),
            "detectorId": str(obj.detector.id),
            "workflowId": str(obj.workflow.id),
        }
