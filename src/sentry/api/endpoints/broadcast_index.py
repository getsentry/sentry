from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
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
        # limit to only a few "recent" broadcasts
        broadcasts = list(Broadcast.objects.filter(
            Q(date_expires__isnull=True) | Q(date_expires__gt=timezone.now()),
            is_active=True,
        ).order_by('-date_added')[:5])

        return Response(serialize(broadcasts, request.user))

    def put(self, request):
        serializer = BroadcastSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        queryset = Broadcast.objects.filter(
            is_active=True,
        )

        ids = request.GET.getlist('id')
        if ids:
            queryset = queryset.filter(
                id__in=ids,
            )

        if result.get('hasSeen'):
            if not request.user.is_authenticated():
                return Response(status=401)

            if ids:
                unseen_queryset = queryset
            else:
                unseen_queryset = queryset.exclude(
                    id__in=queryset.filter(
                        broadcastseen__user=request.user,
                    ).values('id')
                )

            for broadcast in unseen_queryset:
                try:
                    with transaction.atomic():
                        BroadcastSeen.objects.create(
                            broadcast=broadcast,
                            user=request.user,
                        )
                except IntegrityError:
                    pass

        return Response(result)
