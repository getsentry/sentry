from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, OrganizationMember
from sentry.utils.http import absolute_uri


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        organization = obj.organization
        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=~getattr(OrganizationMember.flags, 'sso:linked'),
        ).count()

        return {
            'id': six.text_type(obj.id),
            'provider_name': obj.provider,
            'pending_links_count': pending_links_count,
            'login_url': absolute_uri(reverse('sentry-organization-home', args=[organization.slug])),
            'default_role': organization.default_role,
            'require_link': not obj.flags.allow_unlinked,
        }
