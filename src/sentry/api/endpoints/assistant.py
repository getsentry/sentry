from copy import deepcopy
from enum import Enum

from django.db import IntegrityError
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.assistant import manager
from sentry.models.assistant import AssistantActivity

VALID_STATUSES = frozenset(("viewed", "dismissed", "restart"))


class Status(Enum):
    VIEWED = "viewed"
    DISMISSED = "dismissed"
    RESTART = "restart"


class AssistantSerializer(serializers.Serializer):
    guide = serializers.CharField(required=False)
    guide_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(choices=list(zip(VALID_STATUSES, VALID_STATUSES)))
    useful = serializers.BooleanField(required=False)

    def validate_guide_id(self, value):
        valid_ids = manager.get_valid_ids()
        if value not in valid_ids:
            raise serializers.ValidationError("Not a valid assistant guide_id")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        guide = attrs.get("guide")
        guide_id = attrs.get("guide_id")

        if guide_id:
            return attrs

        if not guide and not guide_id:
            raise serializers.ValidationError("Either assistant guide or guide_id is required")

        guide_id = manager.get_guide_id(guide)
        if not guide_id:
            raise serializers.ValidationError("Not a valid assistant guide")

        attrs["guide_id"] = guide_id
        return attrs


@control_silo_endpoint
class AssistantEndpoint(Endpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Return all the guides with a 'seen' attribute if it has been 'viewed' or 'dismissed'."""
        guide_map = deepcopy(manager.all())
        seen_ids = set(
            AssistantActivity.objects.filter(user_id=request.user.id).values_list(
                "guide_id", flat=True
            )
        )

        return Response([{"guide": key, "seen": id in seen_ids} for key, id in guide_map.items()])

    def put(self, request: Request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide_id': <guide_id> - OR -
            'guide': guide key (e.g. 'issue'),
            'status': 'viewed' / 'dismissed' / 'restart',
            'useful' (optional): true / false,
        }
        """
        serializer = AssistantSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        guide_id = data["guide_id"]
        status = data["status"]
        useful = data.get("useful")

        fields = {}
        if status == Status.RESTART.value:
            AssistantActivity.objects.filter(user_id=request.user.id, guide_id=guide_id).delete()
        else:
            if useful is not None:
                fields["useful"] = useful
            if status == Status.VIEWED.value:
                fields["viewed_ts"] = timezone.now()
            elif status == Status.DISMISSED.value:
                fields["dismissed_ts"] = timezone.now()

            try:
                AssistantActivity.objects.create(
                    user_id=request.user.id, guide_id=guide_id, **fields
                )
            except IntegrityError:
                pass

        return HttpResponse(status=201)
