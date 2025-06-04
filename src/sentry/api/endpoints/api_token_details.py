from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.fields import CharField
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.endpoints.api_tokens import get_appropriate_user_id
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.models.apitoken import ApiToken

ALLOWED_FIELDS = ["name", "tokenId"]


class ApiTokenNameSerializer(serializers.Serializer):
    name = CharField(max_length=255, allow_blank=True, required=True)


@control_silo_endpoint
class ApiTokenDetailsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.SECURITY
    permission_classes = (SentryIsAuthenticated,)

    @method_decorator(never_cache)
    def get(self, request: Request, token_id: int) -> Response:

        user_id = get_appropriate_user_id(request=request)

        try:
            instance = ApiToken.objects.get(id=token_id, application__isnull=True, user_id=user_id)
        except ApiToken.DoesNotExist:
            raise ResourceDoesNotExist(detail="Invalid token ID")

        return Response(serialize(instance, request.user, include_token=False))

    @method_decorator(never_cache)
    def put(self, request: Request, token_id: int) -> Response:
        keys = list(request.data.keys())
        if any(key not in ALLOWED_FIELDS for key in keys):
            return Response(
                {"error": "Only auth token name can be edited after creation"}, status=403
            )

        serializer = ApiTokenNameSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        user_id = get_appropriate_user_id(request=request)

        try:
            token_to_rename = ApiToken.objects.get(
                id=token_id, application__isnull=True, user_id=user_id
            )
        except ApiToken.DoesNotExist:
            raise ResourceDoesNotExist(detail="Invalid token ID")

        token_to_rename.name = result.get("name")
        token_to_rename.save()

        return Response(serialize(token_to_rename, request.user, include_token=False), status=200)

    @method_decorator(never_cache)
    def delete(self, request: Request, token_id: int) -> Response:

        user_id = get_appropriate_user_id(request=request)

        try:
            token_to_delete = ApiToken.objects.get(
                id=token_id, application__isnull=True, user_id=user_id
            )
        except ApiToken.DoesNotExist:
            raise ResourceDoesNotExist(detail="Invalid token ID")

        token_to_delete.delete()
        analytics.record(
            "api_token.deleted",
            user_id=user_id,
        )
        return Response(status=204)
