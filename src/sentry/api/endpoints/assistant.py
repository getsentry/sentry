from __future__ import absolute_import

import six

from copy import deepcopy

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
    guide = serializers.CharField(required=False)
    guide_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(choices=zip(VALID_STATUSES, VALID_STATUSES))
    useful = serializers.BooleanField(required=False)

    def validate_guide_id(self, value):
        valid_ids = manager.get_valid_ids()
        if value not in valid_ids:
            raise serializers.ValidationError("Not a valid assistant guide_id")
        return value

    def validate(self, attrs):
        attrs = super(AssistantSerializer, self).validate(attrs)
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


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Return all the guides with a 'seen' attribute if it has been 'viewed' or 'dismissed'."""
        guides = deepcopy(manager.all())
        seen_ids = set(
            AssistantActivity.objects.filter(user=request.user).values_list("guide_id", flat=True)
        )

        for key, value in six.iteritems(guides):
            value["seen"] = value["id"] in seen_ids

        if "v2" in request.GET:
            guides = [{"guide": key, "seen": value["seen"]} for key, value in six.iteritems(guides)]
        return Response(guides)

    def put(self, request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide_id': <guide_id> - OR -
            'guide': guide key (e.g. 'issue'),
            'status': 'viewed' / 'dismissed',
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
