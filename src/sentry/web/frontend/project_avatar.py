from sentry.models import ProjectAvatar
from sentry.web.frontend.base import AvatarPhotoView


class ProjectAvatarPhotoView(AvatarPhotoView):
    model = ProjectAvatar
