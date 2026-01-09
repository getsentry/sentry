from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, NotRequired, TypedDict

from django.db.models import Count
from drf_spectacular.utils import extend_schema_serializer

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.serializers.models.group import SimpleGroupSerializer
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import GroupStatus
from sentry.models.options.project_option import ProjectOption
from sentry.types.actor import Actor
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    DataConditionGroup,
    DataSourceDetector,
    Detector,
    DetectorGroup,
    DetectorWorkflow,
)


class OwnerSerializerResponse(TypedDict):
    type: str
    id: str
    name: str
    email: NotRequired[str]


class DetectorSerializerResponseOptional(TypedDict, total=False):
    owner: OwnerSerializerResponse | None
    createdBy: str | None
    alertRuleId: int | None
    ruleId: int | None
    latestGroup: dict | None
    description: str | None


@extend_schema_serializer(exclude_fields=["alertRuleId", "ruleId"])
class DetectorSerializerResponse(DetectorSerializerResponseOptional):
    id: str
    projectId: str
    name: str
    type: str
    workflowIds: list[str]
    dateCreated: datetime
    dateUpdated: datetime
    dataSources: list[dict] | None
    conditionGroup: dict | None
    config: dict
    enabled: bool
    openIssues: int


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

        # Fetch alert rule mappings
        # TODO: Remove alert rule mappings as they're deprecated
        alert_rule_mappings = list(AlertRuleDetector.objects.filter(detector__in=item_list))
        alert_rule_map = {
            mapping.detector_id: {
                "alert_rule_id": mapping.alert_rule_id,
                "rule_id": mapping.rule_id,
            }
            for mapping in alert_rule_mappings
        }

        latest_detector_groups = (
            DetectorGroup.objects.filter(detector__in=item_list)
            .select_related("group", "group__project")
            .order_by("detector_id", "-date_added")
            .distinct("detector_id")
        )
        latest_groups_map = {
            dg.detector_id: (
                None
                if dg.group is None
                else serialize(
                    dg.group,
                    user=user,
                    serializer=SimpleGroupSerializer(),
                )
            )
            for dg in latest_detector_groups
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

        open_issues_counts = dict(
            DetectorGroup.objects.filter(detector__in=item_list)
            .filter(group__status=GroupStatus.UNRESOLVED)
            .values("detector_id")
            .annotate(open_issues_count=Count("group"))
            .values_list("detector_id", "open_issues_count")
        )

        # Serialize owners
        owners = [item.owner for item in item_list if item.owner]
        owners_serialized = serialize(
            Actor.resolve_many(owners, filter_none=False), user, ActorSerializer()
        )
        owner_lookup = {owner: serialized for owner, serialized in zip(owners, owners_serialized)}

        for item in item_list:
            attrs[item]["data_sources"] = ds_map.get(item.id)
            attrs[item]["condition_group"] = condition_group_map.get(
                str(item.workflow_condition_group_id)
            )
            attrs[item]["workflow_ids"] = workflows_map[item.id]
            attrs[item]["alert_rule_mapping"] = alert_rule_map.get(
                item.id,
                {
                    "alert_rule_id": None,
                    "rule_id": None,
                },
            )
            attrs[item]["latest_group"] = latest_groups_map.get(item.id)
            attrs[item]["open_issues_count"] = open_issues_counts.get(item.id, 0)
            if item.id in configs:
                attrs[item]["config"] = configs[item.id]
            else:
                attrs[item]["config"] = item.config
            attrs[item]["owner"] = item.owner and owner_lookup.get(item.owner) or None

        return attrs

    def serialize(self, obj: Detector, attrs: Mapping[str, Any], user, **kwargs) -> dict[str, Any]:
        alert_rule_mapping = attrs.get("alert_rule_mapping", {})
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "name": obj.name,
            "description": obj.description,
            "type": obj.type,
            "workflowIds": attrs.get("workflow_ids"),
            "owner": attrs.get("owner"),
            "createdBy": str(obj.created_by_id) if obj.created_by_id else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dataSources": attrs.get("data_sources"),
            "conditionGroup": attrs.get("condition_group"),
            "config": convert_dict_key_case(attrs.get("config"), snake_to_camel_case),
            "enabled": obj.enabled,
            "alertRuleId": alert_rule_mapping.get("alert_rule_id"),
            "ruleId": alert_rule_mapping.get("rule_id"),
            "latestGroup": attrs.get("latest_group"),
            "openIssues": attrs.get("open_issues_count", 0),
        }
