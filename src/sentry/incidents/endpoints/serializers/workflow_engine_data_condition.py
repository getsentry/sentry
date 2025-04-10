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
    DataConditionGroupAction,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class WorkflowEngineDataConditionSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[DataCondition],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> defaultdict[str, list[dict[str, Any]]]:
        data_conditions = {item.id: item for item in item_list}
        data_condition_groups = [
            data_condition.condition_group for data_condition in data_conditions.values()
        ]
        action_filter_data_condition_groups = (
            DataCondition.objects.filter(
                comparison__in=[DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM],
                condition_result=True,
                type=Condition.ISSUE_PRIORITY_EQUALS,
            )
            .exclude(
                condition_group__in=Subquery(
                    Detector.objects.filter(
                        workflow_condition_group__in=data_condition_groups
                    ).values("workflow_condition_group")
                )
            )
            .values_list("condition_group", flat=True)
        )

        action_filter_data_condition_group_action_ids = DataConditionGroupAction.objects.filter(
            condition_group_id__in=Subquery(action_filter_data_condition_groups)
        ).values_list("id", flat=True)
        actions = Action.objects.filter(
            id__in=action_filter_data_condition_group_action_ids
        ).order_by("id")

        serialized_actions = serialize(
            list(actions), user, WorkflowEngineActionSerializer(), **kwargs
        )
        result: DefaultDict[DataCondition, dict[str, list[str]]] = defaultdict(dict)
        result["actions"] = []

        for action in serialized_actions:
            result["actions"].append(action)
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

        if obj.condition_result == DetectorPriorityLevel.LOW:
            resolve_comparison = obj.comparison
        else:
            critical_detector_trigger = DataCondition.objects.get(
                condition_group=obj.condition_group, condition_result=DetectorPriorityLevel.HIGH
            )
            resolve_comparison = critical_detector_trigger.comparison

        resolve_trigger_data_condition = DataCondition.objects.get(
            condition_group=obj.condition_group,
            comparison=resolve_comparison,
            condition_result=DetectorPriorityLevel.OK,
            type=(
                Condition.GREATER_OR_EQUAL
                if obj.type == Condition.LESS_OR_EQUAL
                else Condition.LESS_OR_EQUAL
            ),
        )
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
                if resolve_trigger_data_condition.type == Condition.LESS_OR_EQUAL
                else AlertRuleThresholdType.BELOW.value
            ),
            "alertThreshold": translate_data_condition_type(
                detector.config.get("comparison_delta"),
                obj.type,
                obj.comparison,
            ),
            "resolveThreshold": (
                AlertRuleThresholdType.ABOVE
                if resolve_trigger_data_condition.type == Condition.GREATER_OR_EQUAL
                else AlertRuleThresholdType.BELOW
            ),
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
