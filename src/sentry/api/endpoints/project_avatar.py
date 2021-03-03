from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectAvatar


class ProjectAvatarEndpoint(AvatarMixin, ProjectEndpoint):
    object_type = "project"
    model = ProjectAvatar
