from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import AssistantActivity
from sentry.assistant import manager

VALID_STATUSES = frozenset(('viewed', 'dismissed'))


class AssistantSerializer(serializers.Serializer):
    guide_id = serializers.IntegerField(required=True)
    status = serializers.ChoiceField(
        choices=zip(VALID_STATUSES, VALID_STATUSES),
        required=True,
    )
    useful = serializers.BooleanField()

    def validate_guide_id(self, attrs, source):
        value = attrs[source]
        valid_ids = manager.get_valid_ids()

        if not value:
            raise serializers.ValidationError('Assistant guide id is required')
        if value not in valid_ids:
            raise serializers.ValidationError('Not a valid assistant guide id')
        return attrs


def get_guides(user):
    seen_ids = set(AssistantActivity.objects.filter(
        user=user,
    ).values_list('guide_id', flat=True))
    result = {}
    for k, v in GUIDES.items():
        v['seen'] = k in seen_ids
        result[k] = v
    return result


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """Return all the guides the user has not viewed or dismissed."""
        guides = manager.all()
        exclude_ids = set(AssistantActivity.objects.filter(
            user=request.user,
        ).values_list('guide_id', flat=True))
        result = {k: v for k, v in guides.items() if v['id'] not in exclude_ids}

        return Response(result)

    def put(self, request):
        """Mark a guide as viewed or dismissed.

        Request is of the form {
            'guide_id': <guide_id>,
            'status': 'viewed' / 'dismissed',
            'useful' (optional): true / false,
        }

        Response is the full list (same as a GET call)
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

        return Response(get_guides(request.user), status=201)
