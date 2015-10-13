from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, ProjectKey
from sentry.web.frontend.base import ProjectView


class RemoveProjectKeyView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project, key_id):
        try:
            key = ProjectKey.objects.get(
                id=key_id,
                project=project,
            )
        except ProjectKey.DoesNotExist():
            return self.redirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

        data = key.get_audit_log_data()

        key.delete()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=key.id,
            event=AuditLogEntryEvent.PROJECTKEY_REMOVE,
            data=data,
        )

        messages.add_message(
            request, messages.SUCCESS,
            _('The API key (%s) was revoked.') % (key.public_key,))

        return self.redirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))
