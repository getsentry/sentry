from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.web.frontend.base import AvatarPhotoView, control_silo_view


@control_silo_view
class SentryAppAvatarPhotoView(AvatarPhotoView):
    model = SentryAppAvatar
