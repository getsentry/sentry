from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Broadcast, BroadcastSeen


class BroadcastSerializer(serializers.Serializer):
    hasSeen = serializers.BooleanField()


class BroadcastIndexEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        broadcasts = list(Broadcast.objects.filter(
            is_active=True
        ))

        return Response(serialize(broadcasts, request.user))

    def put(self, request):
        serializer = BroadcastSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        # limit scope of query
        queryset = Broadcast.objects.filter(
            is_active=True,
        )[:100]

        if result.get('hasSeen'):
            for broadcast in queryset:
                try:
                    with transaction.atomic():
                        BroadcastSeen.objects.create(
                            broadcast=broadcast,
                            user=request.user,
                        )
                except IntegrityError:
                    pass

        return Response(result)
