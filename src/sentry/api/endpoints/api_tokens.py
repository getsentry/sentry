from __future__ import absolute_import

from django.conf import settings
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.fields import MultipleChoiceField
from sentry.api.serializers import serialize
from sentry.models import ApiToken


class ApiTokenSerializer(serializers.Serializer):
    scopes = MultipleChoiceField(
        required=True,
        choices=settings.SENTRY_SCOPES,
    )


class ApiTokensEndpoint(Endpoint):
    authentication_classes = (
        SessionAuthentication,
    )
    permission_classes = (
        IsAuthenticated,
    )

    def get(self, request):
        token_list = list(ApiToken.objects.filter(
            application__isnull=True,
            user=request.user,
        ).select_related('application'))

        return Response(serialize(token_list, request.user))

    def post(self, request):
        serializer = ApiTokenSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            token = ApiToken.objects.create(
                user=request.user,
                scope_list=result['scopes'],
                refresh_token=None,
                expires_at=None,
            )

            return Response(serialize(token, request.user), status=201)
        return Response(serializer.errors, status=400)

    def delete(self, request):
        token = request.DATA.get('token')
        if not token:
            return Response({'token': ''}, status=400)

        ApiToken.objects.filter(
            user=request.user,
            token=token,
            application__isnull=True,
        ).delete()

        return Response(status=204)
