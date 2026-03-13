from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.web.frontend.base import AvatarPhotoView, cell_silo_view


@cell_silo_view
class OrganizationAvatarPhotoView(AvatarPhotoView):
    model = OrganizationAvatar
