from __future__ import absolute_import

from datetime import timedelta
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.assistant.guides import GUIDES
from sentry.models import AssistantActivity


VALID_GUIDE_IDS = frozenset(v['id'] for v in GUIDES.values())
VALID_STATUSES = frozenset(('viewed', 'dismissed', 'snoozed'))
VALID_SNOOZE_DURATION_HOURS = frozenset((1, 24, 24 * 7))


class AssistantSerializer(serializers.Serializer):
    guide_id = serializers.ChoiceField(
        choices=zip(VALID_GUIDE_IDS, VALID_GUIDE_IDS),
        required=True,
    )
    status = serializers.ChoiceField(
        choices=zip(VALID_STATUSES, VALID_STATUSES),
        required=True,
    )
    duration_hours = serializers.ChoiceField(
        choices=zip(VALID_SNOOZE_DURATION_HOURS, VALID_SNOOZE_DURATION_HOURS),
    )
    useful = serializers.BooleanField()

    def validate(self, data):
        if (data['status'] == 'snoozed' and
                data.get('duration_hours') not in VALID_SNOOZE_DURATION_HOURS):
            raise serializers.ValidationError("must specify a valid snooze duration")
        return data


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """Return all the guides the user has not seen, dismissed, or snoozed."""
        exclude = AssistantActivity.objects.filter(
            user=request.user,
        ).exclude(
            snoozed_until_ts__lt=timezone.now(),
        )
        exclude_ids = set(e.id for e in exclude)
        result = {k: v for k, v in GUIDES.items() if v['id'] not in exclude_ids}

        return Response(result)

    def put(self, request):
        """Mark a guide as having been viewed, dismissed, or snoozed.

        Request is of the form {
            'guide_id': <guide_id>,
            'status': 'viewed' / 'dismissed' / 'snoozed',
            'useful': true / false / null,
            'duration_hours': <if snoozed, for how many hours>,
        }
        """
        serializer = AssistantSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        guide_id = request.DATA['guide_id']
        status = request.DATA['status']
        duration_hours = request.DATA.get('duration_hours')
        useful = request.DATA.get('useful')

        fields = {}
        if useful is not None:
            fields['useful'] = useful
        if status == 'viewed':
            fields['viewed_ts'] = timezone.now()
        elif status == 'dismissed':
            fields['dismissed_ts'] = timezone.now()
        else:
            fields['snoozed_until_ts'] = timezone.now() + timedelta(hours=duration_hours)

        AssistantActivity.objects.get_or_create(
            user=request.user, guide_id=guide_id, **fields
        )

        return HttpResponse(status=201)
