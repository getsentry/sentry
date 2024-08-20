from datetime import datetime
from typing import TypedDict

from rest_framework import serializers

from sentry.api.serializers.base import Serializer, register, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.escalation_policies.endpoints.serializers.escalation_policy import (
    EscalationPolicySerializerResponse,
)
from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)
from sentry.models.group import Group


class EscalationPolicyStatePutSerializer(serializers.Serializer):
    state = serializers.ChoiceField(choices=EscalationPolicyStateType.get_choices())


class EscalationPolicyStateSerializerResponse(TypedDict, total=False):
    id: int
    group: BaseGroupSerializerResponse
    escalationPolicy: EscalationPolicySerializerResponse
    runStepN: int
    runStepAt: datetime
    state: EscalationPolicyStateType


@register(EscalationPolicyState)
class EscalationPolicyStateSerializer(Serializer):
    def __init__(self):
        super().__init__()

    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user)

        groups = {
            group.id: group
            for group in Group.objects.filter(
                id__in=[i.group_id for i in item_list if i.group_id]
            ).all()
        }
        escalation_policies = {
            policy.id: policy
            for policy in EscalationPolicy.objects.filter(
                id__in=[i.escalation_policy_id for i in item_list]
            ).all()
        }

        for policy in item_list:
            results[policy] = {
                "group": serialize(groups.get(policy.group_id)),
                "escalation_policy": serialize(
                    escalation_policies.get(policy.escalation_policy_id)
                ),
            }
        return results

    def serialize(self, obj, attrs, user, **kwargs):
        return EscalationPolicyStateSerializerResponse(
            id=obj.id,
            runStepN=obj.run_step_n,
            runStepAt=obj.run_step_at,
            state=obj.state,
            escalationPolicy=attrs["escalation_policy"],
            group=attrs["group"],
        )
