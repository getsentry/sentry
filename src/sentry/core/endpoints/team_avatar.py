from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.models.avatars.team_avatar import TeamAvatar


@cell_silo_endpoint
class TeamAvatarEndpoint(AvatarMixin[TeamAvatar], TeamEndpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "team"
    model = TeamAvatar

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
