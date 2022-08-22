from sentry.models import DocIntegrationAvatar
from sentry.web.frontend.base import AvatarPhotoView


class DocIntegrationAvatarPhotoView(AvatarPhotoView):
    model = DocIntegrationAvatar
