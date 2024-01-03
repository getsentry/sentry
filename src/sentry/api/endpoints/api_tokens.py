from django.conf import settings
from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
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
    scopes = MultipleChoiceField(required=True, choices=settings.SENTRY_SCOPES)


@control_silo_endpoint
class ApiTokensEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (IsAuthenticated,)

    @method_decorator(never_cache)
    def get(self, request: Request) -> Response:
        user_id = request.user.id
        if is_active_superuser(request):
            user_id = request.GET.get("userId", user_id)

        token_list = list(
            ApiToken.objects.filter(application__isnull=True, user_id=user_id).select_related(
                "application"
            )
        )
        # TODO: when the delete endpoint no longer requires the full token value, update this to stop including token
        return Response(serialize(token_list, request.user))

    @method_decorator(never_cache)
    def post(self, request: Request) -> Response:
        serializer = ApiTokenSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            token = ApiToken.objects.create(
                user_id=request.user.id,
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
        user_id = request.user.id
        if is_active_superuser(request):
            user_id = request.data.get("userId", user_id)
        # TODO: we should not be requiring full token value in the delete endpoint, and should instead be using the id
        token = request.data.get("token")
        if not token:
            return Response({"token": ""}, status=400)

        with outbox_context(transaction.atomic(router.db_for_write(ApiToken)), flush=False):
            for token in ApiToken.objects.filter(
                user_id=user_id, token=token, application__isnull=True
            ):
                token.delete()

        analytics.record("api_token.deleted", user_id=request.user.id)

        return Response(status=204)
