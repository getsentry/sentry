from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.fields import CharField, IntegerField
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_204_NO_CONTENT, HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.models.apitoken import ApiToken
from sentry.models.outbox import outbox_context

from .utils import get_appropriate_user_id


class ApiTokenPatchSerializer(serializers.Serializer):
    userId = IntegerField(min_value=1, required=False)
    name = CharField(max_length=255, allow_blank=True, required=False)

    def to_internal_value(self, data):
        allowed_fields = set(self.fields.keys())
        incoming_fields = set(data.keys())
        extra_fields = incoming_fields - allowed_fields

        # DRF silenty drops any extra fields that aren't declared in the serializer, but in this case
        # we want to let the user know they've passed invalid field. For example, if a user tried to pass
        # `scopes` to update them after creation.
        if extra_fields:
            raise serializers.ValidationError(
                f"Invalid fields provided. Valid fields only include: {', '.join(allowed_fields)}"
            )

        return super().to_internal_value(data)


@control_silo_endpoint
class ApiTokenDetailsEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PATCH": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (IsAuthenticated,)

    @method_decorator(never_cache)
    def get(self, request: Request, token_id: int) -> Response:
        try:
            user_id = get_appropriate_user_id(request)
            token = ApiToken.objects.get(id=token_id, user_id=user_id, application_id=None)
        except ApiToken.DoesNotExist:
            return Response(status=HTTP_404_NOT_FOUND)

        return Response(serialize(token, request.user, include_token=False))

    @method_decorator(never_cache)
    def patch(self, request: Request, token_id: int) -> Response:
        serializer = ApiTokenPatchSerializer(data=request.data)

        if serializer.is_valid():
            with outbox_context(transaction.atomic(router.db_for_write(ApiToken)), flush=False):
                try:
                    user_id = get_appropriate_user_id(request)
                    token = ApiToken.objects.get(id=token_id, user_id=user_id, application_id=None)

                    new_name = serializer.validated_data.get("name", token.name)

                    if token.name != new_name:
                        token.name = new_name
                        token.save(update_fields=["name"])

                    return Response(status=HTTP_204_NO_CONTENT)
                except ApiToken.DoesNotExist:
                    return Response(status=HTTP_404_NOT_FOUND)

        return Response(status=HTTP_400_BAD_REQUEST)

    @method_decorator(never_cache)
    def delete(self, request: Request, token_id: int) -> Response:
        with outbox_context(transaction.atomic(router.db_for_write(ApiToken)), flush=False):
            try:
                user_id = get_appropriate_user_id(request)
                token_to_delete = ApiToken.objects.get(
                    id=token_id, user_id=user_id, application_id=None
                )

                token_to_delete.delete()

                analytics.record("api_token.deleted", user_id=request.user.id)

            except ApiToken.DoesNotExist:
                return Response(status=HTTP_404_NOT_FOUND)

            return Response(status=HTTP_204_NO_CONTENT)
