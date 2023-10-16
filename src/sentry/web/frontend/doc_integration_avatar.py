from sentry.models.avatars.doc_integration_avatar import DocIntegrationAvatar
from sentry.web.frontend.base import AvatarPhotoView


class DocIntegrationAvatarPhotoView(AvatarPhotoView):
    model = DocIntegrationAvatar
