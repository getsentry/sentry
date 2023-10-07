from sentry.models.avatars.project_avatar import ProjectAvatar
from sentry.web.frontend.base import AvatarPhotoView


class ProjectAvatarPhotoView(AvatarPhotoView):
    model = ProjectAvatar
