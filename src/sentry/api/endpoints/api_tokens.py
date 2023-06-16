from django.conf import settings
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication, control_silo_endpoint
from sentry.api.fields import MultipleChoiceField
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models import ApiToken
from sentry.security import capture_security_activity


class ApiTokenSerializer(serializers.Serializer):
    scopes = MultipleChoiceField(required=True, choices=settings.SENTRY_SCOPES)


@control_silo_endpoint
class ApiTokensEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    @never_cache
    def get(self, request: Request) -> Response:
        user_id = request.user.id
        if is_active_superuser(request):
            user_id = request.GET.get("userId", user_id)

        token_list = list(
            ApiToken.objects.filter(application__isnull=True, user_id=user_id).select_related(
                "application"
            )
        )

        return Response(serialize(token_list, request.user))

    @never_cache
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

            return Response(serialize(token, request.user), status=201)
        return Response(serializer.errors, status=400)

    @never_cache
    def delete(self, request: Request):
        user_id = request.user.id
        if is_active_superuser(request):
            user_id = request.data.get("userId", user_id)
        token = request.data.get("token")
        if not token:
            return Response({"token": ""}, status=400)

        ApiToken.objects.filter(user_id=user_id, token=token, application__isnull=True).delete()

        return Response(status=204)
