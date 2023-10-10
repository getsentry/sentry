from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.web.frontend.base import AvatarPhotoView, region_silo_view


@region_silo_view
class TeamAvatarPhotoView(AvatarPhotoView):
    model = TeamAvatar
