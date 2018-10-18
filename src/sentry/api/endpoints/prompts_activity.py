from __future__ import absolute_import

import datetime
import calendar
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import PromptsActivity, Organization

PROMPTS = {'releases': {'required_fields': ['organization_id'],
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
        if not attrs[source]:
            raise serializers.ValidationError('Must specify feature name')
        if attrs[source] not in PROMPTS:
            raise serializers.ValidationError('Not a valid feature prompt')
        return attrs


class PromptsActivityEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """ Return feature prompt status if dismissed or in snoozed period"""

        data = request.GET.dict()
        feature = data.get('feature')

        if feature is None:
            return Response({'detail': 'Missing feature name'}, status=400)

        required_fields = PROMPTS[feature]['required_fields']
        for field in required_fields:
            if field not in data.keys():
                return Response({'detail': 'Missing required fields'}, status=400)

        prompts_result = []
        if feature == 'releases':
            prompts_result = PromptsActivity.objects.filter(user=request.user,
                                                            organization=Organization.objects.get(
                                                                id=data.get('organization_id')),
                                                            feature='releases',)
        response = {}
        if prompts_result:
            data = prompts_result[0].data
            if data.get('snoozed_ts'):
                snoozed_ts = datetime.datetime.fromtimestamp(data.get('snoozed_ts'))
                if snoozed_ts > datetime.datetime.now() - datetime.timedelta(days=3):
                    status = 'snoozed'
                    response['data'] = {'status': status}
            elif data.get('dismissed_ts'):
                status = 'dismissed'
                response['data'] = {'status': status}

        return Response(response)

    def put(self, request):
        serializer = PromptsActivitySerializer(
            data=request.DATA,
            partial=True,
            context={
                'user': request.user,
                'request': request,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.object
        feature = serialized['feature']
        status = serialized['status']
        required_fields = PROMPTS[feature]['required_fields']

        fields = {}
        if 'organization_id' in required_fields:
            try:
                organization = Organization.objects.get(id=request.DATA.get('organization_id'))
                fields['organization'] = organization
            except Organization.DoesNotExist:
                return Response({'detail': 'Invalid organization'}, status=400)

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
                    data=data,
                    **fields
                )
        except IntegrityError:
            pass
        return HttpResponse(status=201)
