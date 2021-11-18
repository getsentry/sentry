from sentry.models import SentryAppAvatar
from sentry.web.frontend.base import AvatarPhotoView


class SentryAppAvatarPhotoView(AvatarPhotoView):
    model = SentryAppAvatar
