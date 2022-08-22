from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import OrganizationAvatar


class OrganizationAvatarEndpoint(AvatarMixin, OrganizationEndpoint):
    object_type = "organization"
    model = OrganizationAvatar

    def get_avatar_filename(self, obj):
        # for consistency with organization details endpoint
        return f"{obj.slug}.png"
