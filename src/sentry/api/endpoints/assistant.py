from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import AssistantActivity
from sentry.assistant import manager

VALID_STATUSES = frozenset(('viewed', 'dismissed'))


class AssistantSerializer(serializers.Serializer):
    VALID_GUIDE_IDS = frozenset(manager.get_valid_ids())

    guide_id = serializers.ChoiceField(
        choices=zip(VALID_GUIDE_IDS, VALID_GUIDE_IDS),
        required=True,
    )
    status = serializers.ChoiceField(
        choices=zip(VALID_STATUSES, VALID_STATUSES),
        required=True,
    )
    useful = serializers.BooleanField()


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """Return all the guides the user has not viewed or dismissed."""
        GUIDES = manager.all()
        exclude_ids = set(AssistantActivity.objects.filter(
            user=request.user,
        ).values_list('guide_id', flat=True))
        result = {k: v for k, v in GUIDES.items() if v['id'] not in exclude_ids}

        return Response(result)

    def put(self, request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide_id': <guide_id>,
            'status': 'viewed' / 'dismissed',
            'useful' (optional): true / false,
        }
        """
        serializer = AssistantSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        guide_id = request.DATA['guide_id']
        status = request.DATA['status']
        useful = request.DATA.get('useful')

        fields = {}
        if useful is not None:
            fields['useful'] = useful
        if status == 'viewed':
            fields['viewed_ts'] = timezone.now()
        elif status == 'dismissed':
            fields['dismissed_ts'] = timezone.now()

        try:
            with transaction.atomic():
                AssistantActivity.objects.create(
                    user=request.user, guide_id=guide_id, **fields
                )
        except IntegrityError:
            pass

        return HttpResponse(status=201)
