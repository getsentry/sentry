from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import PromptsActivity

VALID_STATUSES = frozenset(('snoozed', 'dismissed'))

PROMPTS = ['releases']


class PromptsActivitySerializer(serializers.Serializer):
    feature = serializers.CharField(required=True)

    def validate_feature(self, attrs, source):
        pass


class PromptsActivityEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """ Return all prompts that are dismissed or in snoozed period"""
        # prompt_status = PromptsActivity.objects.filter(
        #     organization_id=request.GET['organization_id'],
        #     user=request.user,
        # )

        prompts = []
        return Response(prompts)

    def put(self, request):
        serializer = PromptsActivitySerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        organization_id = request.DATA['organization_id']
        project_id = request.DATA['project_id']
        feature = request.DATA['feature']
        status = request.DATA['status']
        data = {}

        if status == 'snoozed':
            data['snoozed_ts'] = timezone.now()
        elif status == 'dismissed':
            data['dismissed_ts'] = timezone.now()

        try:
            with transaction.atomic():
                PromptsActivity.objects.create_or_update(
                    organization_id=organization_id,
                    project_id=project_id,
                    feature=feature,
                    user=request.user,
                    data=data
                )
        except IntegrityError:
            pass
        return HttpResponse(status=201)
