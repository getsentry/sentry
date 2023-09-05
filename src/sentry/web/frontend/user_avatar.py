from sentry.models import UserAvatar
from sentry.web.frontend.base import AvatarPhotoView, control_silo_view


@control_silo_view
class UserAvatarPhotoView(AvatarPhotoView):
    model = UserAvatar
