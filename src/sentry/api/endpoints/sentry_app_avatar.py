from rest_framework.response import Response

from sentry import features
from sentry.api.bases import SentryAppBaseEndpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.models import SentryAppAvatar


class SentryAppAvatarEndpoint(AvatarMixin, SentryAppBaseEndpoint):
    object_type = "sentry_app"
    model = SentryAppAvatar

    def get(self, request, **kwargs):
        sentry_app = kwargs.get("sentry_app", None)

        if features.has("organizations:sentry-app-logo-upload", sentry_app.owner):
            return super().get(request, access=request.access, **kwargs)
        else:
            return Response({"detail": ["You do not have that feature enabled"]}, status=400)

    def put(self, request, **kwargs):
        sentry_app = kwargs.get("sentry_app", None)

        if features.has("organizations:sentry-app-logo-upload", sentry_app.owner):
            return super().put(request, access=request.access, **kwargs)
        else:
            return Response({"detail": ["You do not have that feature enabled"]}, status=400)

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.svg"
