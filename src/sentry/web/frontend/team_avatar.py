from sentry.models import TeamAvatar
from sentry.web.frontend.base import AvatarPhotoView, region_silo_view


@region_silo_view
class TeamAvatarPhotoView(AvatarPhotoView):
    model = TeamAvatar
