from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.organization import Organization


@cell_silo_endpoint
class OrganizationAvatarEndpoint(
    AvatarMixin[OrganizationAvatar, Organization], OrganizationEndpoint
):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "organization"
    model = OrganizationAvatar

    def get_avatar_filename(self, obj: Organization) -> str:
        # for consistency with organization details endpoint
        return f"{obj.slug}.png"
