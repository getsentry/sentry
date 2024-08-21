from datetime import UTC, datetime, timedelta
from typing import TypedDict

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.serializers.base import Serializer, register, serialize
from sentry.api.serializers.models.team import BaseTeamSerializerResponse
from sentry.escalation_policies.logic import RotationPeriod, coalesce_schedule_layers
from sentry.escalation_policies.models.rotation_schedule import (
    RotationSchedule,
    RotationScheduleLayer,
    RotationScheduleOverride,
    RotationScheduleUserOrder,
)
from sentry.models.team import Team
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class RotationScheduleLayerPutSerializer(serializers.Serializer):
    rotation_type = serializers.CharField(max_length=256, required=True)
    handoff_time = serializers.CharField(max_length=32, required=True)
    schedule_layer_restrictions = serializers.JSONField()
    start_date = serializers.DateTimeField(required=True)
    user_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class RotationSchedulePutSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    organization_id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=256, required=True)

    schedule_layers = serializers.ListField(
        child=RotationScheduleLayerPutSerializer(), required=True
    )
    # Owner
    team_id = serializers.IntegerField(required=False)
    user_id = serializers.IntegerField(required=False)

    def create(self, validated_data):
        """
        Create or replace an RotationSchedule instance from the validated data.
        """
        validated_data["organization_id"] = self.context["organization"].id
        with transaction.atomic(router.db_for_write(RotationSchedule)):
            overrides = []
            if "id" in validated_data:
                # We're updating, so we need to maintain overrides
                overrides = RotationScheduleOverride.objects.filter(
                    rotation_schedule_id=validated_data["id"]
                )
                RotationSchedule.objects.filter(id=validated_data["id"]).delete()

            layers = validated_data.pop("schedule_layers")

            schedule = RotationSchedule.objects.create(**validated_data)

            RotationScheduleOverride.objects.bulk_create(
                [
                    RotationScheduleOverride(
                        rotation_schedule_id=schedule.id,
                        user_id=override.user_id,
                        start_time=override.start_time,
                        end_time=override.end_time,
                    )
                    for override in overrides
                ]
            )

            i = 0
            for layer in layers:
                i += 1
                orm_layer = schedule.layers.create(
                    precedence=i,
                    rotation_type=layer["rotation_type"],
                    handoff_time=layer["handoff_time"],
                    schedule_layer_restrictions=layer["schedule_layer_restrictions"],
                    start_date=layer["start_date"],
                )
                for j, user_id in enumerate(layer["user_ids"]):
                    orm_layer.user_orders.create(user_id=user_id, order=j)
        return schedule


class RotationPeriodResponse(TypedDict):
    startTime: datetime
    endTime: datetime
    userId: int


class RotationScheduleLayerSerializerResponse(TypedDict, total=False):
    rotationType: str
    handoffTime: str
    scheduleLayerRestrictions: dict
    startTime: datetime
    users: RpcUser
    rotationPeriods: list[RotationPeriodResponse]


class RotationScheduleSerializerResponse(TypedDict, total=False):
    id: int
    name: str
    description: str | None
    organizationId: int
    scheduleLayers: list[RotationScheduleLayerSerializerResponse]
    # Owner
    team: BaseTeamSerializerResponse
    user: RpcUser
    coalescedRotationPeriods: list[RotationPeriodResponse]


def serialize_rotation_periods(
    rotation_periods: list[RotationPeriod],
) -> list[RotationPeriodResponse]:
    return [
        {
            "startTime": period["start_time"],
            "endTime": period["end_time"],
            "userId": period["user_id"],
        }
        for period in rotation_periods
    ]


@register(RotationSchedule)
class RotationScheduleSerializer(Serializer):
    def __init__(self, start_date=None, end_date=None):
        super().__init__()
        self.start_date = start_date
        self.end_date = end_date
        if start_date is None:
            self.start_date = datetime.combine(
                datetime.now(tz=UTC), datetime.min.time(), tzinfo=UTC
            )
            self.end_date = self.start_date + timedelta(days=7)

    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user)

        layers = list(
            RotationScheduleLayer.objects.filter(schedule__in=item_list).order_by("precedence")
        )
        user_orders = RotationScheduleUserOrder.objects.filter(
            schedule_layer__in=layers,
        ).all()
        overrides = RotationScheduleOverride.objects.filter(
            rotation_schedule__in=item_list,
            start_time__lte=self.end_date,
            end_time__gte=self.start_date,
        ).all()
        owning_user_ids = [i.user_id for i in item_list if i.user_id]
        owning_team_ids = [i.team_id for i in item_list if i.team_id]
        override_users = [o.user_id for o in overrides]

        teams = {team.id: team for team in Team.objects.filter(id__in=owning_team_ids).all()}
        users = {
            user["id"]: user
            for user in user_service.serialize_many(
                filter={
                    "user_ids": [uo.user_id for uo in user_orders]
                    + owning_user_ids
                    + override_users
                }
            )
        }

        for schedule in item_list:
            schedule_layers = [layer for layer in layers if layer.schedule_id == schedule.id]

            layers_attr = []
            for layer in schedule_layers:
                ordered_users = [
                    (str(uo.user_id), uo.order)
                    for uo in user_orders
                    if uo.schedule_layer_id == layer.id
                ]
                ordered_users.sort(key=lambda tuple: tuple[1])
                ordered_users = [users[user_id] for user_id, _ in ordered_users]
                layers_attr.append(
                    RotationScheduleLayerSerializerResponse(
                        rotationType=layer.rotation_type,
                        handoffTime=layer.handoff_time,
                        scheduleLayerRestrictions=layer.schedule_layer_restrictions,
                        startTime=layer.start_date,
                        users=ordered_users,
                        rotationPeriods=serialize_rotation_periods(
                            coalesce_schedule_layers([layer], self.start_date, self.end_date)
                        ),
                    )
                )
            coalesced_rotation_periods = serialize_rotation_periods(
                coalesce_schedule_layers(schedule.layers.all(), self.start_date, self.end_date)
            )
            results[schedule] = {
                "team": serialize(teams.get(schedule.team_id)),
                "user": users.get(schedule.user_id),
                "layers": layers_attr,
                "coalesced_rotation_periods": coalesced_rotation_periods,
            }
        return results

    def serialize(self, obj, attrs, user, **kwargs):
        return RotationScheduleSerializerResponse(
            id=obj.id,
            name=obj.name,
            description=obj.description,
            organizationId=obj.organization.id,
            scheduleLayers=attrs["layers"],
            team=attrs["team"],
            user=attrs["user"],
            coalescedRotationPeriods=attrs["coalesced_rotation_periods"],
        )
