from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

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
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    WorkflowDataConditionGroup,
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
        # Build the chain: trigger → detector → workflows → workflow DCGs,
        # keeping per-detector scoping so actions don't bleed across detectors.

        # trigger.condition_group → detector
        condition_group_ids = {t.condition_group_id for t in item_list}
        cg_to_detector_id: dict[int, int] = {
            d.workflow_condition_group_id: d.id
            for d in Detector.objects.filter(workflow_condition_group__in=condition_group_ids)
        }

        # detector → workflow IDs
        detector_ids = set(cg_to_detector_id.values())
        detector_to_workflow_ids: dict[int, set[int]] = defaultdict(set)
        for det_id, wf_id in DetectorWorkflow.objects.filter(detector__in=detector_ids).values_list(
            "detector_id", "workflow_id"
        ):
            detector_to_workflow_ids[det_id].add(wf_id)

        # workflow → workflow DCG IDs
        all_workflow_ids: set[int] = set()
        for wf_ids in detector_to_workflow_ids.values():
            all_workflow_ids.update(wf_ids)

        workflow_to_dcg_ids: dict[int, set[int]] = defaultdict(set)
        for wf_id, dcg_id in WorkflowDataConditionGroup.objects.filter(
            workflow_id__in=all_workflow_ids
        ).values_list("workflow_id", "condition_group_id"):
            workflow_to_dcg_ids[wf_id].add(dcg_id)

        # detector → workflow DCG IDs
        detector_to_dcg_ids: dict[int, set[int]] = {}
        for det_id, wf_ids in detector_to_workflow_ids.items():
            dcg_ids: set[int] = set()
            for wf_id in wf_ids:
                dcg_ids.update(workflow_to_dcg_ids.get(wf_id, set()))
            detector_to_dcg_ids[det_id] = dcg_ids

        # Bulk-fetch action-filter DataConditions across all workflow DCGs
        all_dcg_ids: set[int] = set()
        for dcg_ids in detector_to_dcg_ids.values():
            all_dcg_ids.update(dcg_ids)

        # Map (condition_group_id, comparison) → action-filter DC exists in that DCG
        # We need: for a given detector's DCGs + priority level → matching DCG IDs
        # NOTE: Assumes DataConditions are limited to what would be dual written.
        dcg_comparison_pairs: dict[int, set[int]] = defaultdict(set)
        for dc in DataCondition.objects.filter(condition_group__in=all_dcg_ids):
            # Map comparison value → set of DCG IDs that have an action filter at that level
            dcg_comparison_pairs[dc.condition_group_id].add(dc.comparison)

        # Bulk-fetch all DCG → action mappings
        dcg_to_action_ids: dict[int, list[int]] = defaultdict(list)
        for dcga in DataConditionGroupAction.objects.filter(condition_group_id__in=all_dcg_ids):
            dcg_to_action_ids[dcga.condition_group_id].append(dcga.action_id)

        # Bulk-fetch all actions
        all_action_ids: set[int] = set()
        for action_ids in dcg_to_action_ids.values():
            all_action_ids.update(action_ids)
        actions_by_id = {a.id: a for a in Action.objects.filter(id__in=all_action_ids)}

        # Bulk-fetch alert_rule_trigger_id mappings
        trigger_id_map: dict[int, int | None] = dict(
            DataConditionAlertRuleTrigger.objects.filter(data_condition__in=item_list).values_list(
                "data_condition_id", "alert_rule_trigger_id"
            )
        )

        result: defaultdict[DataCondition, dict[str, list[str]]] = defaultdict(dict)

        for trigger in item_list:
            detector_id = cg_to_detector_id.get(trigger.condition_group_id)
            trigger_dcg_ids = detector_to_dcg_ids.get(detector_id, set()) if detector_id else set()

            # Find DCGs in this detector's workflows that match the trigger's priority level
            matching_dcg_ids = [
                dcg_id
                for dcg_id in trigger_dcg_ids
                if trigger.condition_result in dcg_comparison_pairs.get(dcg_id, set())
            ]

            # Collect actions from those DCGs
            actions = sorted(
                [
                    actions_by_id[action_id]
                    for dcg_id in matching_dcg_ids
                    for action_id in dcg_to_action_ids.get(dcg_id, [])
                    if action_id in actions_by_id
                ],
                key=lambda a: a.id,
            )

            alert_rule_trigger_id = trigger_id_map.get(
                trigger.id, get_fake_id_from_object_id(trigger.id)
            )

            serialized_actions = serialize(
                actions,
                user,
                WorkflowEngineActionSerializer(),
                alert_rule_trigger_id=alert_rule_trigger_id,
            )
            result[trigger]["actions"] = serialized_actions

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
            # For static/metric rules, calculate resolve threshold from the resolve condition
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
