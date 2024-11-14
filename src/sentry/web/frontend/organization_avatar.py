from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.web.frontend.base import AvatarPhotoView, region_silo_view


@region_silo_view
class OrganizationAvatarPhotoView(AvatarPhotoView):
    model = OrganizationAvatar
