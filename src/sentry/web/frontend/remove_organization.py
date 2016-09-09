from __future__ import absolute_import

import logging
from uuid import uuid4

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntryEvent, OrganizationStatus, Organization
from sentry.tasks.deletion import delete_organization
from sentry.web.frontend.base import OrganizationView

ERR_DEFAULT_ORG = _('You cannot remove the default organization.')

MSG_REMOVE_SUCCESS = _('The %s organization has been scheduled for removal.')

delete_logger = logging.getLogger('sentry.deletions.ui')


class RemoveOrganizationForm(forms.Form):
    pass


class RemoveOrganizationView(OrganizationView):
    required_scope = 'org:delete'
    sudo_required = True

    def get_form(self, request, organization):
        if request.method == 'POST':
            return RemoveOrganizationForm(request.POST)
        return RemoveOrganizationForm()

    def handle(self, request, organization):
        if organization.is_default:
            messages.add_message(request, messages.ERROR, ERR_DEFAULT_ORG)
            return self.redirect(reverse('sentry-organization-home', args=[
                organization.slug
            ]))

        form = self.get_form(request, organization)
        if form.is_valid():
            updated = Organization.objects.filter(
                id=organization.id,
                status=OrganizationStatus.VISIBLE,
            ).update(status=OrganizationStatus.PENDING_DELETION)
            if updated:
                transaction_id = uuid4().hex
                countdown = 86400

                entry = self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=AuditLogEntryEvent.ORG_REMOVE,
                    data=organization.get_audit_log_data(),
                    transaction_id=transaction_id,
                )

                organization.send_delete_confirmation(entry, countdown)

                delete_organization.apply_async(
                    kwargs={
                        'object_id': organization.id,
                        'transaction_id': transaction_id,
                    },
                    countdown=countdown,
                )

                delete_logger.info('object.delete.queued', extra={
                    'object_id': organization.id,
                    'transaction_id': transaction_id,
                    'model': Organization.__name__,
                })

            messages.add_message(request, messages.SUCCESS,
                MSG_REMOVE_SUCCESS % (organization.name,))

            return self.redirect(reverse('sentry'))

        context = {
            'form': form,
            'team_list': organization.team_set.all(),
        }

        return self.respond('sentry/remove-organization.html', context)
