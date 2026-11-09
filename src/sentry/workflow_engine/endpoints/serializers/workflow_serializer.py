from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Annotated, Any, Literal, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.apidocs.descriptions import ApiDescription, ApiSchema
from sentry.constants import ObjectStatusName
from sentry.types.actor import Actor
from sentry.workflow_engine.endpoints.serializers.response_schemas import (
    action_config_schema,
    condition_comparison_schema,
    workflow_config_schema,
)
from sentry.workflow_engine.generated_schema_types import (
    ActionConfigResponse,
    ConditionComparisonResponse,
    WorkflowConfig,
)
from sentry.workflow_engine.models import (
    DataConditionGroup,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.processors.workflow_fire_history import get_last_fired_dates

# The values of Action.Type and DataConditionGroup.Type.
ActionTypeName = Literal[
    "slack",
    "slack_staging",
    "msteams",
    "discord",
    "pagerduty",
    "opsgenie",
    "github",
    "github_enterprise",
    "jira",
    "jira_server",
    "vsts",
    "email",
    "sentry_app",
    "plugin",
    "webhook",
    "seer_workflow",
]
LogicTypeName = Literal["any", "any-short", "all", "none"]


class ActionSerializerResponse(TypedDict, total=False):
    id: Annotated[str, ApiDescription("ID of the action")]
    type: Annotated[ActionTypeName, ApiDescription("Type of the action")]
    integrationId: Annotated[
        str | None,
        ApiDescription("ID of the integration the action uses. Null for actions without one"),
    ]
    data: Annotated[
        dict[str, str], ApiDescription("Extra data for the action, which depends on its type")
    ]
    config: Annotated[
        ActionConfigResponse,
        ApiDescription("Configuration of the action, such as targetType and targetIdentifier"),
        ApiSchema(action_config_schema),
    ]
    status: Annotated[ObjectStatusName, ApiDescription("Status of the action")]


class ConditionSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the condition")]
    type: Annotated[str, ApiDescription("Type of the condition, such as first_seen_event or level")]
    comparison: Annotated[
        ConditionComparisonResponse,
        ApiDescription("Value the condition compares against, which depends on its type"),
        ApiSchema(condition_comparison_schema),
    ]
    conditionResult: Annotated[
        bool | int | float | None,
        ApiDescription(
            "Result the condition produces when it matches: true for alert conditions, or the "
            "priority level for monitor conditions"
        ),
    ]


class TriggerSerializerResponse(TypedDict, total=False):
    id: Annotated[str, ApiDescription("ID of the condition group")]
    organizationId: Annotated[str, ApiDescription("ID of the organization")]
    logicType: Annotated[LogicTypeName, ApiDescription("How the conditions in the group combine")]
    conditions: Annotated[
        list[ConditionSerializerResponse], ApiDescription("Conditions in the group")
    ]
    actions: Annotated[
        list[ActionSerializerResponse], ApiDescription("Actions to fire when the conditions pass")
    ]


class WorkflowSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("Alert ID")]
    name: Annotated[str, ApiDescription("Alert name")]
    organizationId: Annotated[str, ApiDescription("ID of the organization the alert belongs to")]
    createdBy: Annotated[str | None, ApiDescription("ID of the user who created the alert")]
    dateCreated: Annotated[datetime, ApiDescription("When the alert was created (ISO 8601)")]
    dateUpdated: Annotated[datetime, ApiDescription("When the alert was last updated (ISO 8601)")]
    triggers: Annotated[
        TriggerSerializerResponse | None, ApiDescription("Conditions on which the alert triggers")
    ]
    actionFilters: Annotated[
        list[TriggerSerializerResponse] | None,
        ApiDescription("Filters to run before actions fire, each with the actions to fire"),
    ]
    environment: Annotated[
        str | None,
        ApiDescription(
            "Name of the environment the alert is limited to. Null for all environments"
        ),
    ]
    config: Annotated[
        WorkflowConfig,
        ApiDescription("Configuration of the alert, such as frequency in minutes"),
        ApiSchema(workflow_config_schema),
    ]
    detectorIds: Annotated[
        list[str] | None, ApiDescription("IDs of the monitors connected to the alert")
    ]
    enabled: Annotated[bool, ApiDescription("Whether the alert is enabled")]
    lastTriggered: Annotated[
        datetime | None, ApiDescription("When the alert last fired (ISO 8601)")
    ]
    owner: Annotated[
        str | None, ApiDescription("Team or user that owns the alert, such as user:123 or team:456")
    ]


@register(Workflow)
class WorkflowSerializer(Serializer[WorkflowSerializerResponse]):
    def get_attrs(
        self, item_list: Sequence[Workflow], user: Any, **kwargs: Any
    ) -> MutableMapping[Workflow, dict[str, Any]]:
        prefetch_related_objects(item_list, "environment")
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
        last_triggered_map = get_last_fired_dates([w.id for w in item_list])

        wdcg_list = list(
            WorkflowDataConditionGroup.objects.filter(workflow__in=item_list).select_related(
                "condition_group"
            )
        )
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
            attrs[item]["lastTriggered"] = last_triggered_map.get(item.id)
            attrs[item]["environment"] = item.environment.name if item.environment else None

            owner_actor = Actor.from_id(user_id=item.owner_user_id, team_id=item.owner_team_id)
            attrs[item]["owner"] = owner_actor.identifier if owner_actor else None

        return attrs

    def serialize(
        self, obj: Workflow, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> WorkflowSerializerResponse:
        return {
            "id": str(obj.id),
            "name": str(obj.name),
            "organizationId": str(obj.organization_id),
            "createdBy": str(obj.created_by_id) if obj.created_by_id else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "triggers": attrs.get("triggers"),
            "actionFilters": attrs.get("actionFilters"),
            "environment": attrs.get("environment"),
            "config": convert_dict_key_case(obj.config, snake_to_camel_case),
            "detectorIds": attrs.get("detectorIds"),
            "enabled": obj.enabled,
            "lastTriggered": attrs.get("lastTriggered"),
            "owner": attrs.get("owner"),
        }
