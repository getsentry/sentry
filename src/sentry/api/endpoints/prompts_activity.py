from __future__ import absolute_import

import calendar
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import PromptsActivity

PROMPTS = {
    'releases': {
        'required_fields': ['organization_id', 'project_id'],
    },
}

VALID_STATUSES = frozenset(('snoozed', 'dismissed'))


class PromptsActivitySerializer(serializers.Serializer):
    feature = serializers.CharField(required=True)
    status = serializers.ChoiceField(
        choices=zip(VALID_STATUSES, VALID_STATUSES),
        required=True,
    )

    def validate_feature(self, attrs, source):
        if attrs[source] is None:
            raise serializers.ValidationError('Must specify feature name')
        if attrs[source] not in PROMPTS:
            raise serializers.ValidationError('Not a valid feature prompt')
        return attrs


class PromptsActivityEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """ Return feature prompt status if dismissed or in snoozed period"""

        feature = request.GET.get('feature')

        if feature not in PROMPTS:
            return Response({'detail': 'Invalid feature name'}, status=400)

        required_fields = PROMPTS[feature]['required_fields']
        for field in required_fields:
            if field not in request.GET:
                return Response({'detail': 'Missing required field "%s"' % field}, status=400)

        filters = {k: request.GET.get(k) for k in required_fields}

        try:
            result = PromptsActivity.objects.get(user=request.user,
                                                 feature='releases',
                                                 **filters)
        except PromptsActivity.DoesNotExist:
            return Response({})

        return Response({'data': result.data})

    def put(self, request):
        serializer = PromptsActivitySerializer(
            data=request.DATA,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.object
        feature = serialized['feature']
        status = serialized['status']

        required_fields = PROMPTS[feature]['required_fields']
        fields = {k: request.DATA.get(k) for k in required_fields}

        if any(elem is None for elem in fields.values()):
            return Response({'detail': 'Missing required field'}, status=400)

        data = {}
        now = calendar.timegm(timezone.now().utctimetuple())
        if status == 'snoozed':
            data['snoozed_ts'] = now
        elif status == 'dismissed':
            data['dismissed_ts'] = now

        try:
            with transaction.atomic():
                PromptsActivity.objects.create_or_update(
                    feature=feature,
                    user=request.user,
                    values={
                        'data': data,
                    },
                    **fields
                )
        except IntegrityError:
            pass
        return HttpResponse(status=201)
