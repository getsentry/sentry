from __future__ import absolute_import

from copy import deepcopy

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import AssistantActivity
from sentry.assistant import manager

VALID_STATUSES = frozenset(("viewed", "dismissed"))


class AssistantSerializer(serializers.Serializer):
    guide_id = serializers.IntegerField(required=True)
    status = serializers.ChoiceField(choices=zip(VALID_STATUSES, VALID_STATUSES), required=True)
    useful = serializers.BooleanField()

    def validate_guide_id(self, value):
        valid_ids = manager.get_valid_ids()

        if not value:
            raise serializers.ValidationError("Assistant guide id is required")
        if value not in valid_ids:
            raise serializers.ValidationError("Not a valid assistant guide id")
        return value


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Return all the guides with a 'seen' attribute if it has been 'viewed' or 'dismissed'."""
        guides = deepcopy(manager.all())
        seen_ids = set(
            AssistantActivity.objects.filter(user=request.user).values_list("guide_id", flat=True)
        )
        for k, v in guides.items():
            v["seen"] = v["id"] in seen_ids
        return Response(guides)

    def put(self, request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide_id': <guide_id>,
            'status': 'viewed' / 'dismissed',
            'useful' (optional): true / false,
        }
        """
        serializer = AssistantSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        guide_id = request.data["guide_id"]
        status = request.data["status"]
        useful = request.data.get("useful")

        fields = {}
        if useful is not None:
            fields["useful"] = useful
        if status == "viewed":
            fields["viewed_ts"] = timezone.now()
        elif status == "dismissed":
            fields["dismissed_ts"] = timezone.now()

        try:
            with transaction.atomic():
                AssistantActivity.objects.create(user=request.user, guide_id=guide_id, **fields)
        except IntegrityError:
            pass

        return HttpResponse(status=201)
