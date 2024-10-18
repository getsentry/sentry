from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.sentry_apps.api.parsers.sentry_app_avatar import SentryAppAvatarParser
from sentry.sentry_apps.api.serializers.sentry_app import SentryAppSerializer
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar


@control_silo_endpoint
class SentryAppAvatarEndpoint(AvatarMixin[SentryAppAvatar], SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "sentry_app"
    model = SentryAppAvatar
    serializer_cls = SentryAppAvatarParser

    def get(self, request: Request, **kwargs) -> Response:
        return super().get(
            request, access=request.access, serializer=SentryAppSerializer(), **kwargs
        )

    def put(self, request: Request, **kwargs) -> Response:
        return super().put(
            request, access=request.access, serializer=SentryAppSerializer(), **kwargs
        )

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
