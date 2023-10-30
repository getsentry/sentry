from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.avatars.project_avatar import ProjectAvatar


@region_silo_endpoint
class ProjectAvatarEndpoint(AvatarMixin, ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    object_type = "project"
    model = ProjectAvatar
