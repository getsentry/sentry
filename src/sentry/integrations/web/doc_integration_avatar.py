from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar
from sentry.web.frontend.base import AvatarPhotoView, control_silo_view


@control_silo_view
class DocIntegrationAvatarPhotoView(AvatarPhotoView):
    model = DocIntegrationAvatar
