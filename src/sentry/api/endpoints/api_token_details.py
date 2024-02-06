from django.conf import settings
from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.fields import CharField
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_204_NO_CONTENT, HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.fields import MultipleChoiceField
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models.apitoken import ApiToken
from sentry.models.outbox import outbox_context
from sentry.security.utils import capture_security_activity


class ApiTokenUpdateSerializer(serializers.Serializer):
    name = CharField(max_length=255, allow_blank=True, required=False)


@control_silo_endpoint
class ApiTokenDetailsEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (IsAuthenticated,)

    @method_decorator(never_cache)
    def get(self, request: Request, token_id: int) -> Response:
        try:
            token = ApiToken.objects.get(id=token_id, user_id=request.user.id, application_id=None)
        except ApiToken.DoesNotExist:
            return Response(status=HTTP_404_NOT_FOUND)

        return Response(serialize(token, request.user, include_token=False))

    @method_decorator(never_cache)
    def put(self, request: Request, token_id: int) -> Response:
        serializer = ApiTokenUpdateSerializer(data=request.data)

        if serializer.is_valid():
            try:
                token = ApiToken.objects.get(
                    id=token_id, user_id=request.user.id, application_id=None
                )
            except ApiToken.DoesNotExist:
                return Response(status=HTTP_404_NOT_FOUND)

            new_name = serializer.validated_data.get("name", token.name)

            if token.name != new_name:
                token.name = new_name
                token.save(update_fields=["name"])

            return Response(status=HTTP_204_NO_CONTENT)

        return Response(status=HTTP_400_BAD_REQUEST)
