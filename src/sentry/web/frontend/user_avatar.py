from sentry.models import UserAvatar
from sentry.web.frontend.base import AvatarPhotoView


class UserAvatarPhotoView(AvatarPhotoView):
    model = UserAvatar
