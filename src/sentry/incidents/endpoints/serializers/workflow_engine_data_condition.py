from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, DefaultDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.endpoints.utils import translate_data_condition_type
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    DataCondition,
    DataConditionAlertRuleTrigger,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowEngineDataConditionSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[DataCondition],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> defaultdict[DataCondition, dict[str, list[str]]]:
        detector_triggers = {item.id: item for item in item_list}
        detector_trigger_ids = [dc.id for dc in item_list]

        # below, we go from detector trigger to action filter
        detector_ids = Subquery(
            Detector.objects.filter(
                workflow_condition_group__in=[
                    detector_trigger.condition_group
                    for detector_trigger in detector_triggers.values()
                ]
            ).values_list("id", flat=True)
        )
        workflow_dcg_ids = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow__in=Subquery(
                DetectorWorkflow.objects.filter(detector__in=detector_ids).values_list(
                    "workflow_id", flat=True
                )
            )
        ).values_list("id", flat=True)
        action_filter_data_condition_groups = DataCondition.objects.filter(
            comparison__in=[item.condition_result for item in item_list],
            condition_group__in=Subquery(workflow_dcg_ids),
        ).values_list("condition_group", flat=True)

        action_filter_data_condition_group_action_ids = DataConditionGroupAction.objects.filter(
            condition_group_id__in=Subquery(action_filter_data_condition_groups)
        ).values_list("id", flat=True)

        actions = Action.objects.filter(
            id__in=Subquery(action_filter_data_condition_group_action_ids)
        ).order_by("id")

        serialized_actions = serialize(
            list(actions), user, WorkflowEngineActionSerializer(), **kwargs
        )
        result: DefaultDict[DataCondition, dict[str, list[str]]] = defaultdict(dict)
        for data_condition in detector_triggers:
            result[detector_triggers[data_condition]]["actions"] = []

        for action in serialized_actions:
            # in practice we only ever have 1 data condition in the item list at a time, but we may have multiple actions
            result[detector_triggers[detector_trigger_ids[0]]]["actions"].append(action)

        return result

    def serialize(
        self,
        obj: DataCondition,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, Any]:
        # XXX: we are assuming that the obj/DataCondition is a detector trigger
        detector = Detector.objects.get(workflow_condition_group=obj.condition_group)

        alert_rule_trigger_id = DataConditionAlertRuleTrigger.objects.values_list(
            "alert_rule_trigger_id", flat=True
        ).get(data_condition=obj)
        alert_rule_id = AlertRuleDetector.objects.values_list("alert_rule_id", flat=True).get(
            detector=detector.id
        )
        return {
            "id": str(alert_rule_trigger_id),
            "alertRuleId": str(alert_rule_id),
            "label": (
                "critical" if obj.condition_result == DetectorPriorityLevel.HIGH else "warning"
            ),
            "thresholdType": (
                AlertRuleThresholdType.ABOVE.value
                if obj.type == Condition.GREATER
                else AlertRuleThresholdType.BELOW.value
            ),
            "alertThreshold": translate_data_condition_type(
                detector.config.get("comparison_delta"),
                obj.type,
                obj.comparison,
            ),
            "resolveThreshold": (
                AlertRuleThresholdType.BELOW.value
                if obj.type == Condition.GREATER
                else AlertRuleThresholdType.ABOVE.value
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
