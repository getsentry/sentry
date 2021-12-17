from sentry.api.bases import SentryAppBaseEndpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.serializers.rest_framework.sentry_app import SentryAppAvatarSerializer
from sentry.models import SentryAppAvatar


class SentryAppAvatarEndpoint(AvatarMixin, SentryAppBaseEndpoint):
    object_type = "sentry_app"
    model = SentryAppAvatar
    serializer_cls = SentryAppAvatarSerializer

    def get(self, request, **kwargs):
        return super().get(request, access=request.access, **kwargs)

    def put(self, request, **kwargs):
        return super().put(request, access=request.access, **kwargs)

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
