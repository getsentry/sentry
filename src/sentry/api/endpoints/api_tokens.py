from __future__ import absolute_import

from operator import or_
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from six.moves import reduce

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.fields import MultipleChoiceField
from sentry.api.serializers import serialize
from sentry.models import ApiToken


class ApiTokenSerializer(serializers.Serializer):
    scopes = MultipleChoiceField(
        required=True,
        choices=ApiToken.scopes.keys(),
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
            user=request.user,
        ))

        return Response(serialize(token_list, request.user))

    def post(self, request):
        serializer = ApiTokenSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            token = ApiToken.objects.create(
                user=request.user,
                scopes=reduce(or_, (
                    getattr(ApiToken.scopes, k) for k in result['scopes']
                )),
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
        ).delete()

        return Response(status=204)
