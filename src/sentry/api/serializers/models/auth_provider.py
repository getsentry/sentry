from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.db.models import F

from sentry import features
from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, OrganizationMember
from sentry.utils.http import absolute_uri


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        organization = obj.organization
        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=F('flags').bitand(~OrganizationMember.flags['sso:linked']),
        ).count()

        if features.has('sentry10'):
            login_url = reverse('sentry-organization-issue-list', args=[organization.slug])
        else:
            login_url = reverse('sentry-organization-home', args=[organization.slug])

        return {
            'id': six.text_type(obj.id),
            'provider_name': obj.provider,
            'pending_links_count': pending_links_count,
            'login_url': absolute_uri(login_url),
            'default_role': organization.default_role,
            'require_link': not obj.flags.allow_unlinked,
        }
