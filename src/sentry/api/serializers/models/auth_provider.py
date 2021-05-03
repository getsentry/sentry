from django.db.models import F

from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, OrganizationMember  # SentryAppInstallationForProvider
from sentry.utils.http import absolute_uri


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        organization = obj.organization
        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        login_url = organization.get_url()

        if obj.flags.scim_enabled:
            sentry_app_installation = SentryAppInstallationForProvider.objects.get(
                organization=obj.organization.id, provider=f"{obj.provider}_scim"
            )
            scim_api_token = sentry_app_installation.get_token(
                self.organization_id, provider=f"{obj.provider}_scim"
            )
        else:
            scim_api_token = None

        return {
            "id": str(obj.id),
            "provider_name": obj.provider,
            "pending_links_count": pending_links_count,
            "login_url": absolute_uri(login_url),
            "default_role": organization.default_role,
            "require_link": not obj.flags.allow_unlinked,
            "enable_scim": bool(obj.flags.scim_enabled),
            "scim_api_token": scim_api_token,
        }
