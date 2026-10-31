from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.models.release_threshold.constants import (
    THRESHOLD_TYPE_INT_TO_STR,
    TRIGGER_TYPE_INT_TO_STR,
    ThresholdTypeName,
    TriggerTypeName,
)
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ReleaseThresholdSerializerResponse(TypedDict):
    id: str
    threshold_type: ThresholdTypeName
    trigger_type: TriggerTypeName
    value: int
    window_in_seconds: int
    project: object
    environment: object | None
    date_added: datetime


@register(ReleaseThreshold)
class ReleaseThresholdSerializer(Serializer[ReleaseThresholdSerializerResponse]):
    def serialize(
        self,
        obj: ReleaseThreshold,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ReleaseThresholdSerializerResponse:
        return {
            "id": str(obj.id),
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[obj.threshold_type],
            "trigger_type": TRIGGER_TYPE_INT_TO_STR[obj.trigger_type],
            "value": obj.value,
            "window_in_seconds": obj.window_in_seconds,
            "project": serialize(obj.project),
            "environment": serialize(obj.environment) if obj.environment else None,
            "date_added": obj.date_added,
        }
