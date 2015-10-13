from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from operator import or_

from sentry.models import ApiKey, AuditLogEntry, AuditLogEntryEvent
from sentry.web.frontend.base import OrganizationView

DEFAULT_SCOPES = [
    'project:read',
    'event:read',
    'team:read',
    'org:read',
    'member:read',
]


class OrganizationApiKeysView(OrganizationView):
    required_scope = 'org:delete'

    def handle(self, request, organization):
        if request.POST.get('op') == 'newkey':
            key = ApiKey.objects.create(
                organization=organization,
                scopes=reduce(or_, [getattr(ApiKey.scopes, s) for s in DEFAULT_SCOPES])
            )

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=key.id,
                event=AuditLogEntryEvent.APIKEY_ADD,
                data=key.get_audit_log_data(),
            )

            redirect_uri = reverse('sentry-organization-api-key-settings', args=[
                organization.slug, key.id,
            ])
            return HttpResponseRedirect(redirect_uri)

        elif request.POST.get('op') == 'removekey':
            key = ApiKey.objects.get(
                id=request.POST.get('kid'),
                organization=organization,
            )

            audit_data = key.get_audit_log_data()

            key.delete()

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=key.id,
                event=AuditLogEntryEvent.APIKEY_REMOVE,
                data=audit_data,
            )

            return HttpResponseRedirect(request.path)

        key_list = sorted(ApiKey.objects.filter(
            organization=organization,
        ), key=lambda x: x.label)

        context = {
            'key_list': key_list,
        }

        return self.respond('sentry/organization-api-keys.html', context)
