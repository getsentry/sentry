from django.db.models import F

from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, OrganizationMember
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

        return {
            "id": str(obj.id),
            "provider_name": obj.provider,
            "pending_links_count": pending_links_count,
            "login_url": absolute_uri(login_url),
            "default_role": organization.default_role,
            "require_link": not obj.flags.allow_unlinked,
        }
