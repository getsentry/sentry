from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from operator import or_

from sentry.models import ApiKey, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView

DEFAULT_SCOPES = [
    'project:read',
    'event:read',
    'team:read',
    'org:read',
]


class OrganizationApiKeysView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization):
        if request.POST.get('op') == 'newkey':
            key = ApiKey.objects.create(
                organization=organization,
                scopes=reduce(or_, [getattr(ApiKey.scopes, s) for s in DEFAULT_SCOPES])
            )
            redirect_uri = reverse('sentry-organization-api-key-settings', args=[
                organization.slug, key.id,
            ])
            return HttpResponseRedirect(redirect_uri)

        key_list = sorted(ApiKey.objects.filter(
            organization=organization,
        ), key=lambda x: x.label)

        context = {
            'key_list': key_list,
        }

        return self.respond('sentry/organization-api-keys.html', context)
