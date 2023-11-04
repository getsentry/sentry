from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.models.avatars.team_avatar import TeamAvatar


@region_silo_endpoint
class TeamAvatarEndpoint(AvatarMixin, TeamEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    object_type = "team"
    model = TeamAvatar
