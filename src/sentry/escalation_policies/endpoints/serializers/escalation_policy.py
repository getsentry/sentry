from typing import TypedDict

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.team import BaseTeamSerializerResponse
from sentry.escalation_policies.endpoints.serializers.rotation_schedule import (
    RotationScheduleSerializerResponse,
)
from sentry.escalation_policies.models.escalation_policy import (
    EscalationPolicy,
    EscalationPolicyStep,
    EscalationPolicyStepRecipient,
)
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule
from sentry.models.team import Team
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class EscalationPolicyPutStepRecipientSerializer(serializers.Serializer):
    schedule_id = serializers.IntegerField(required=False)
    team_id = serializers.IntegerField(required=False)
    user_id = serializers.IntegerField(required=False)

    def validate(self, data):
        """
        Validate that at least one of schedule_id, team_id, or user_id is present
        """
        error_message = "One of schedule_id, team_id, or user_id must be included in recipients"
        if not any(data.values()):
            raise serializers.ValidationError(error_message)
        return data


class EscalationPolicyPutStepSerializer(serializers.Serializer):
    escalate_after_sec = serializers.IntegerField(min_value=0)
    recipients = serializers.ListField(child=EscalationPolicyPutStepRecipientSerializer())


class EscalationPolicyPutSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=256, required=True)
    description = serializers.CharField(max_length=256, required=False)
    repeat_n_times = serializers.IntegerField(min_value=1, required=True)
    steps = serializers.ListField(child=EscalationPolicyPutStepSerializer())
    # Owner
    team_id = serializers.IntegerField(required=False)
    user_id = serializers.IntegerField(required=False)

    def create(self, validated_data: "EscalationPolicyPutSerializer"):
        """
        Create or replace an EscalationPolicy instance from the validated data.
        """
        validated_data["organization_id"] = self.context["organization"].id
        with transaction.atomic(router.db_for_write(EscalationPolicy)):
            if "id" in validated_data:
                EscalationPolicy.objects.filter(id=validated_data["id"]).delete()
            steps = validated_data.pop("steps")
            escalation_policy = EscalationPolicy.objects.create(**validated_data)
            i = 0
            for step in steps:
                i += 1
                orm_step = escalation_policy.steps.create(
                    escalate_after_sec=step["escalate_after_sec"],
                    step_number=i,
                )
                for recipient in step["recipients"]:
                    orm_step.recipients.create(
                        schedule_id=recipient.get("schedule_id"),
                        team_id=recipient.get("team_id"),
                        user_id=recipient.get("user_id"),
                    )
        return escalation_policy


class EscalationPolicyStepRecipientResponse(TypedDict, total=False):
    type: str
    data: BaseTeamSerializerResponse | RpcUser | RotationScheduleSerializerResponse


class EscalationPolicyStepSerializerResponse(TypedDict, total=False):
    escalate_after_sec: int
    recipients: list[EscalationPolicyStepRecipientResponse]


class EscalationPolicySerializerResponse(TypedDict, total=False):
    id: int
    name: str
    description: str | None
    repeat_n_times: int
    steps: list[EscalationPolicyStepSerializerResponse]
    team: BaseTeamSerializerResponse
    user: RpcUser


@register(EscalationPolicy)
class EscalationPolicySerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user)

        steps = list(
            EscalationPolicyStep.objects.filter(policy__in=item_list).order_by("step_number")
        )
        recipients = EscalationPolicyStepRecipient.objects.filter(
            escalation_policy_step__in=steps
        ).all()
        owning_user_ids = [i.user_id for i in item_list if i.user_id]
        owning_team_ids = [i.team_id for i in item_list if i.team_id]

        teams = {
            team.id: team
            for team in Team.objects.filter(
                id__in=[r.team_id for r in recipients if r.team_id] + owning_team_ids
            ).all()
        }
        users = {
            user.id: user
            for user in user_service.get_many_by_id(
                ids=[r.user_id for r in recipients if r.user_id] + owning_user_ids
            )
        }
        schedules = {
            schedule.id: schedule
            for schedule in RotationSchedule.objects.filter(
                id__in=[r.schedule_id for r in recipients if r.schedule_id]
            ).all()
        }

        for policy in item_list:
            steps = [
                EscalationPolicyStepSerializerResponse(
                    step_number=step.step_number,
                    escalate_after_sec=step.escalate_after_sec,
                    # Team recipients + User recipients + Schedule recipients
                    recipients=[
                        EscalationPolicyStepRecipientResponse(
                            type="team", data=serialize(teams[r.team_id])
                        )
                        for r in recipients
                        if r.escalation_policy_step_id == step.id and r.team_id
                    ]
                    + [
                        EscalationPolicyStepRecipientResponse(
                            type="user", data=serialize(users[r.user_id])
                        )
                        for r in recipients
                        if r.escalation_policy_step_id == step.id and r.user_id
                    ]
                    + [
                        EscalationPolicyStepRecipientResponse(
                            type="schedule", data=serialize(schedules[r.schedule_id])
                        )
                        for r in recipients
                        if r.escalation_policy_step_id == step.id and r.schedule_id
                    ],
                )
                for step in steps
                if step.policy_id == policy.id
            ]
            steps.sort(key=lambda x: x["step_number"])
            results[policy] = {
                "team": teams.get(policy.team_id),
                "user": users.get(policy.user_id),
                "steps": steps,
            }
        return results

    def serialize(self, obj, attrs, user, **kwargs):
        return EscalationPolicySerializerResponse(
            id=str(obj.id),
            name=obj.name,
            description=obj.description,
            repeat_n_times=obj.repeat_n_times,
            steps=attrs["steps"],
            team=attrs["team"],
            user=attrs["user"],
        )
