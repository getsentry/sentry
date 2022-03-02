from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.models import TeamAvatar


class TeamAvatarEndpoint(AvatarMixin, TeamEndpoint):
    object_type = "team"
    model = TeamAvatar
