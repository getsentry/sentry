from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.options.project_option import ProjectOption
from sentry.rules.actions.notify_event_service import PLUGINS_WITH_FIRST_PARTY_EQUIVALENTS
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition_group_action import DataConditionGroupAction
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.types import ActionHandler, DataConditionHandler, DataSourceTypeHandler


class ActionSerializerResponse(TypedDict):
    id: str
    type: str
    integration_id: int | None
    data: dict
    config: dict


@register(Action)
class ActionSerializer(Serializer):
    def serialize(self, obj: Action, *args, **kwargs) -> ActionSerializerResponse:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "integration_id": obj.integration_id,
            "data": obj.data,
            "config": obj.config,
        }


class SentryAppContext(TypedDict):
    id: str
    name: str
    installationId: str
    status: int
    settings: NotRequired[dict[str, Any]]


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
            result["integrations"] = [
                {"id": str(integration.id), "name": integration.name}
                for integration in integrations
            ]

        sentry_app_context = kwargs.get("sentry_app_context")
        if sentry_app_context:
            installation = sentry_app_context.installation
            sentry_app: SentryAppContext = {
                "id": str(installation.sentry_app.id),
                "name": installation.sentry_app.name,
                "installationId": str(installation.id),
                "status": installation.sentry_app.status,
            }
            if sentry_app_context.component:
                sentry_app["settings"] = sentry_app_context.component.app_schema.get("settings", {})
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
            if item.id in configs:
                attrs[item]["config"] = configs[item.id]
            else:
                attrs[item]["config"] = item.config

        return attrs

    def serialize(self, obj: Detector, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "name": obj.name,
            "type": obj.type,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dataSources": attrs.get("data_sources"),
            "conditionGroup": attrs.get("condition_group"),
            "config": attrs.get("config"),
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

        for item in item_list:
            attrs[item]["triggers"] = trigger_condition_map.get(
                item.when_condition_group_id
            )  # when condition group
            attrs[item]["actionFilters"] = dcg_map.get(
                item.id, []
            )  # The data condition groups for filtering actions
        return attrs

    def serialize(self, obj: Workflow, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "name": str(obj.name),
            "organizationId": str(obj.organization_id),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "triggers": attrs.get("triggers"),
            "actionFilters": attrs.get("actionFilters"),
            "environment": obj.environment.name if obj.environment else None,
            "config": obj.config,
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
