from sentry.api.bases.avatar import AvatarMixin
from sentry.api.endpoints.sentry_apps import SentryAppsEndpoint
from sentry.models import SentryAppAvatar


class SentryAppAvatarEndpoint(AvatarMixin, SentryAppsEndpoint):
    object_type = "sentryapp"
    model = SentryAppAvatar

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.svg"
