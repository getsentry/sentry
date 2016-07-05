from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntryEvent, ProjectKey
from sentry.web.forms.projectkeys import EditProjectKeyForm
from sentry.web.frontend.base import ProjectView


class EditProjectKeyView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project, key_id):
        try:
            key = ProjectKey.objects.get(
                id=key_id,
                project=project,
            )
        except ProjectKey.DoesNotExist:
            return self.redirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

        form = EditProjectKeyForm(request.POST or None, instance=key)
        if form.is_valid():
            key = form.save()

            self.create_audit_entry(
                request,
                organization=organization,
                target_object=key.id,
                event=AuditLogEntryEvent.PROJECTKEY_EDIT,
                data=key.get_audit_log_data(),
            )

            messages.add_message(
                request, messages.SUCCESS,
                _('Changes to the API key (%s) were saved.') % (key.public_key,))
            return self.redirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

        context = {
            'page': 'keys',
            'key': key,
            'form': form,
        }

        return self.respond('sentry/projects/edit_key.html', context)
