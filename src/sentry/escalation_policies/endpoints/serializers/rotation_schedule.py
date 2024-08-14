from datetime import datetime, timezone
from typing import TypedDict

from django.db import router, transaction
from django.db.models.query import QuerySet
from rest_framework import serializers

from sentry.api.serializers.base import Serializer, register
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
    start_time = serializers.DateTimeField(required=True)
    user_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class RotationSchedulePutSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=256, required=True)

    schedule_layers = serializers.ListField(
        child=RotationScheduleLayerPutSerializer(), required=True
    )
    # Owner
    team_id = serializers.IntegerField(required=False)
    user_id = serializers.IntegerField(required=False)

    def create(self, validated_data: "RotationScheduleSerializer"):
        """
        Create or replace an RotationSchedule instance from the validated data.
        """
        validated_data["organization_id"] = self.context["organization"].id
        with transaction.atomic(router.db_for_write(RotationSchedule)):
            overrides: QuerySet[RotationScheduleOverride, RotationScheduleOverride] = []
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
                    start_time=layer["start_time"],
                )
                for j, user_id in enumerate(layer["user_ids"]):
                    orm_layer.user_orders.create(user_id=user_id, order=j)
        return schedule


class RotationScheduleLayerSerializerResponse(TypedDict, total=False):
    rotation_type: str
    handoff_time: str
    schedule_layer_restrictions: dict
    start_time: datetime
    users: RpcUser


class RotationScheduleSerializerResponse(TypedDict, total=False):
    id: int
    name: str
    organization_id: int
    schedule_layers: list[RotationScheduleLayerSerializerResponse]
    # Owner
    team_id: int | None
    user_id: int | None


@register(RotationSchedule)
class RotationScheduleSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

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
            end_time__gte=datetime.now(tz=timezone.utc),
        ).all()
        owning_user_ids = [i.user_id for i in item_list if i.user_id]
        owning_team_ids = [i.team_id for i in item_list if i.team_id]
        override_users = [o.user_id for o in overrides]

        teams = {team.id: team for team in Team.objects.filter(id__in=owning_team_ids).all()}
        users = {
            user.id: user
            for user in user_service.get_many_by_id(
                ids=[uo.user_id for uo in user_orders] + owning_user_ids + override_users
            )
        }

        for schedule in item_list:
            schedule_layers = [layer for layer in layers if layer.schedule_id == schedule.id]

            layers_attr = []
            for layer in schedule_layers:
                ordered_users = [
                    (uo.user_id, uo.order) for uo in user_orders if uo.schedule_layer_id == layer.id
                ]
                ordered_users.sort(key=lambda tuple: tuple[1])
                ordered_users = [users[user_id] for user_id, _ in ordered_users]

                layers_attr.append(
                    RotationScheduleLayerSerializerResponse(
                        rotation_type=layer.rotation_type,
                        handoff_time=layer.handoff_time,
                        schedule_layer_restrictions=layer.schedule_layer_restrictions,
                        start_time=layer.start_time,
                        users=ordered_users,
                    )
                )

            results[schedule] = {
                "team": teams.get(schedule.team_id),
                "user": users.get(schedule.user_id),
                "layers": layers_attr,
            }
        return results

    def serialize(self, obj, attrs, user, **kwargs):
        return RotationScheduleSerializerResponse(
            id=str(obj.id),
            name=obj.name,
            organization_id=obj.organization.id,
            layers=attrs["layers"],
            team=attrs["team"],
            user=attrs["user"],
        )
