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

from .utils import get_appropriate_user_id


class ApiTokenSerializer(serializers.Serializer):
    name = CharField(max_length=255, allow_blank=True, required=False)
    scopes = MultipleChoiceField(required=True, choices=settings.SENTRY_SCOPES)


@control_silo_endpoint
class ApiTokensEndpoint(Endpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (IsAuthenticated,)

    @method_decorator(never_cache)
    def get(self, request: Request) -> Response:
        user_id = get_appropriate_user_id(request)

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
