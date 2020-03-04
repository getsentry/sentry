from __future__ import absolute_import

from django.db import IntegrityError
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import AssistantActivity
from sentry.assistant import manager
from sentry.utils.compat import zip

VALID_STATUSES = frozenset(("viewed", "dismissed"))


class AssistantSerializer(serializers.Serializer):
    guide = serializers.CharField(required=True)
    status = serializers.ChoiceField(choices=zip(VALID_STATUSES, VALID_STATUSES), required=True)
    useful = serializers.BooleanField()

    def validate(self, attrs):
        guide = attrs.get("guide")
        if not guide:
            raise serializers.ValidationError("Assistant guide is required")

        guide_id = manager.get_id_by_name(guide)
        if not guide_id:
            raise serializers.ValidationError("Not a valid assistant guide")

        attrs["guide_id"] = guide_id
        return attrs


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Return all the guides with a 'seen' attribute if it has been 'viewed' or 'dismissed'."""
        active_guides = manager.all()
        seen_ids = set(
            AssistantActivity.objects.filter(user=request.user).values_list("guide_id", flat=True)
        )

        guides = [
            {"guide": guide.name.lower(), "seen": guide.value in seen_ids}
            for guide in active_guides
        ]
        return Response(guides)

    def put(self, request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide': guide key (e.g. 'issue_details'),
            'status': 'viewed' / 'dismissed',
            'useful' (optional): true / false,
        }
        """
        serializer = AssistantSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        guide_id = data["guide_id"]
        status = data["status"]
        useful = data.get("useful")

        fields = {}
        if useful is not None:
            fields["useful"] = useful
        if status == "viewed":
            fields["viewed_ts"] = timezone.now()
        elif status == "dismissed":
            fields["dismissed_ts"] = timezone.now()

        try:
            AssistantActivity.objects.create(user=request.user, guide_id=guide_id, **fields)
        except IntegrityError:
            pass

        return HttpResponse(status=201)
