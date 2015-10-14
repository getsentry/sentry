from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.models import AuditLogEntry, AuditLogEntryEvent, ProjectKey
from sentry.web.frontend.base import ProjectView


class CreateProjectKeyView(ProjectView):
    required_scope = 'project:write'

    def post(self, request, organization, team, project):
        key = ProjectKey.objects.create(
            project=project,
        )

        AuditLogEntry.objects.create(
            organization=organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=key.id,
            event=AuditLogEntryEvent.PROJECTKEY_ADD,
            data=key.get_audit_log_data(),
        )

        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))
