from sentry.models import TeamAvatar
from sentry.web.frontend.base import AvatarPhotoView


class TeamAvatarPhotoView(AvatarPhotoView):
    model = TeamAvatar
