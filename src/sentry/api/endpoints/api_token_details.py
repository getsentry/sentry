from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.fields import CharField
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.endpoints.api_tokens import _get_appropriate_user_id
from sentry.models.apitoken import ApiToken
from sentry.models.outbox import outbox_context

ALLOWED_FIELDS = ["name", "tokenId"]


class ApiTokenNameSerializer(serializers.Serializer):
    name = CharField(max_length=255, allow_blank=True, required=True)


@control_silo_endpoint
class ApiTokenDetailsEndpoint(Endpoint):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.SECURITY
    permission_classes = (IsAuthenticated,)

    @method_decorator(never_cache)
    def put(self, request: Request, token_id: int) -> Response:
        keys = list(request.data.keys())

        if any(key not in ALLOWED_FIELDS for key in keys):
            return Response(
                {"error": "Only auth token name can be edited after creation"}, status=403
            )

        serializer = ApiTokenNameSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            user_id = _get_appropriate_user_id(request=request)

            with outbox_context(transaction.atomic(router.db_for_write(ApiToken)), flush=False):
                token_to_rename: ApiToken | None = ApiToken.objects.filter(
                    id=token_id, application__isnull=True, user_id=user_id
                ).first()

                if token_to_rename is None:
                    return Response({"tokenId": token_id, "userId": user_id}, status=400)

                token_to_rename.name = result.get("name", None)
                token_to_rename.save()

            return Response(status=204)
        return Response(serializer.errors, status=400)
