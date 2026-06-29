from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.web.frontend.base import AvatarPhotoView, cell_silo_view


@cell_silo_view
class TeamAvatarPhotoView(AvatarPhotoView):
    model = TeamAvatar
