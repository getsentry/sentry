from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, DefaultDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Subquery

from sentry.api.serializers import Serializer, serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.endpoints.utils import translate_data_condition_type
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.migration_helpers.utils import get_resolve_threshold
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

        # In practice, we only ever serialize one detector trigger at a time.
        detector_trigger = item_list[0]

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
        ).values_list("action_id", flat=True)

        actions = Action.objects.filter(
            id__in=Subquery(action_filter_data_condition_group_action_ids)
        ).order_by("id")

        try:
            alert_rule_trigger_id = DataConditionAlertRuleTrigger.objects.values_list(
                "alert_rule_trigger_id", flat=True
            ).get(data_condition=detector_trigger)
        except DataConditionAlertRuleTrigger.DoesNotExist:
            # this data condition does not have an analog in the old system,
            # but we need to return *something*
            alert_rule_trigger_id = get_fake_id_from_object_id(detector_trigger.id)

        serialized_actions = serialize(
            list(actions),
            user,
            WorkflowEngineActionSerializer(),
            alert_rule_trigger_id=alert_rule_trigger_id,
        )
        result: DefaultDict[DataCondition, dict[str, list[str]]] = defaultdict(dict)
        for data_condition in detector_triggers:
            result[detector_triggers[data_condition]]["actions"] = []

        for action in serialized_actions:
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
        try:
            alert_rule_trigger_id = DataConditionAlertRuleTrigger.objects.values_list(
                "alert_rule_trigger_id", flat=True
            ).get(data_condition=obj)
        except DataConditionAlertRuleTrigger.DoesNotExist:
            # this data condition does not have an analog in the old system,
            # but we need to return *something*
            alert_rule_trigger_id = get_fake_id_from_object_id(obj.id)
        try:
            alert_rule_id = AlertRuleDetector.objects.values_list("alert_rule_id", flat=True).get(
                detector=detector.id
            )
        except AlertRuleDetector.DoesNotExist:
            # this detector does not have an analog in the old system
            alert_rule_id = get_fake_id_from_object_id(detector.id)

        if obj.type == Condition.ANOMALY_DETECTION:
            threshold_type = obj.comparison["threshold_type"]
            resolve_threshold = None
        else:
            threshold_type = (
                AlertRuleThresholdType.ABOVE.value
                if obj.type == Condition.GREATER
                else AlertRuleThresholdType.BELOW.value
            )
            resolve_threshold = translate_data_condition_type(
                detector.config.get("comparison_delta"),
                obj.type,
                get_resolve_threshold(obj.condition_group),
            )

        return {
            "id": str(alert_rule_trigger_id),
            "alertRuleId": str(alert_rule_id),
            "label": (
                "critical" if obj.condition_result == DetectorPriorityLevel.HIGH else "warning"
            ),
            "thresholdType": threshold_type,
            "alertThreshold": translate_data_condition_type(
                detector.config.get("comparison_delta"),
                obj.type,
                (
                    0 if obj.type == Condition.ANOMALY_DETECTION else obj.comparison
                ),  # to replicate existing behavior, where anomaly detection triggers have a threshold of 0
            ),
            "resolveThreshold": resolve_threshold,
            "dateCreated": obj.date_added,
            "actions": attrs.get("actions", []),
        }
