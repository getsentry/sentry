from django.conf import settings
from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.fields import CharField
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

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


class ApiTokenSerializer(serializers.Serializer):
    name = CharField(max_length=255, allow_blank=True, required=False)
    scopes = MultipleChoiceField(required=True, choices=settings.SENTRY_SCOPES)


@control_silo_endpoint
class ApiTokensEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (IsAuthenticated,)

    @classmethod
    def _get_appropriate_user_id(cls, request: Request) -> str:
        """
        Gets the user id to use for the request, based on what the current state of the request is.
        If the request is made by a superuser, then they are allowed to act on behalf of other user's data.
        Therefore, when GET or DELETE endpoints are invoked by the superuser, we may utilize a provided user_id.

        The user_id to use comes from the GET or BODY parameter based on the request type.
        For GET endpoints, the GET dict is used.
        For all others, the DATA dict is used.
        """
        # Get the user id for the user that made the current request as a baseline default
        user_id = request.user.id
        if is_active_superuser(request):
            datastore = request.GET if request.GET else request.data
            # If a userId override is not found, use the id for the user who made the request
            user_id = datastore.get("userId", user_id)

        return user_id

    @method_decorator(never_cache)
    def get(self, request: Request) -> Response:
        user_id = self._get_appropriate_user_id(request=request)

        token_list = list(
            ApiToken.objects.filter(application__isnull=True, user_id=user_id).select_related(
                "application"
            )
        )
        return Response(serialize(token_list, request.user, include_token=False))

    @method_decorator(never_cache)
    def post(self, request: Request) -> Response:
        serializer = ApiTokenSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            token = ApiToken.objects.create(
                user_id=request.user.id,
                name=result.get("name", None),
                scope_list=result["scopes"],
                refresh_token=None,
                expires_at=None,
            )

            capture_security_activity(
                account=request.user,
                type="api-token-generated",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={},
                send_email=True,
            )

            analytics.record("api_token.created", user_id=request.user.id)

            return Response(serialize(token, request.user), status=201)
        return Response(serializer.errors, status=400)

    @method_decorator(never_cache)
    def delete(self, request: Request):
        user_id = self._get_appropriate_user_id(request=request)
        token_id = request.data.get("tokenId", None)
        # Account for token_id being 0, which can be considered valid
        if token_id is None:
            return Response({"tokenId": token_id}, status=400)

        with outbox_context(transaction.atomic(router.db_for_write(ApiToken)), flush=False):
            token_to_delete: ApiToken | None = ApiToken.objects.filter(
                id=token_id, application__isnull=True, user_id=user_id
            ).first()

            if token_to_delete is None:
                return Response({"tokenId": token_id, "userId": user_id}, status=400)

            token_to_delete.delete()

        analytics.record("api_token.deleted", user_id=request.user.id)

        return Response(status=204)
