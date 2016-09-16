from __future__ import absolute_import

import logging
import six

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.models import Organization, OrganizationStatus, AuditLogEntryEvent
from sentry.web.frontend.base import OrganizationView
from sentry.web.helpers import render_to_response


ERR_MESSAGES = {
    OrganizationStatus.VISIBLE: _('Deletion already canceled.'),
    OrganizationStatus.DELETION_IN_PROGRESS: _('Deletion cannot be canceled, already in progress'),
}

MSG_RESTORE_SUCCESS = _('Organization restored successfully.')

delete_logger = logging.getLogger('sentry.deletions.ui')


class RestoreOrganizationView(OrganizationView):
    required_scope = 'org:delete'
    sudo_required = True

    def get_active_organization(self, request, organization_slug):
        # A simply version than what comes from the base
        # OrganizationView. We need to grab an organization
        # that is in any state, not just VISIBLE.
        organizations = Organization.objects.get_for_user(
            user=request.user,
            only_visible=False,
        )

        try:
            return six.next(
                o for o in organizations
                if o.slug == organization_slug
            )
        except StopIteration:
            return None

    def get(self, request, organization):
        if organization.status == OrganizationStatus.VISIBLE:
            return self.redirect(
                reverse('sentry-organization-home', args=[organization.slug])
            )

        context = {
            # If this were named 'organization', it triggers logic in the base
            # template to render organization related content, which isn't relevant
            # here.
            'deleting_organization': organization,
            'pending_deletion': organization.status == OrganizationStatus.PENDING_DELETION,
        }

        return render_to_response('sentry/restore-organization.html', context, self.request)

    def post(self, request, organization):
        if organization.status != OrganizationStatus.PENDING_DELETION:
            messages.add_message(request, messages.ERROR, ERR_MESSAGES[organization.status])
            return self.redirect(reverse('sentry'))

        updated = Organization.objects.filter(
            id=organization.id,
            status=OrganizationStatus.PENDING_DELETION,
        ).update(status=OrganizationStatus.VISIBLE)
        if updated:
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_RESTORE,
                data=organization.get_audit_log_data(),
            )
            delete_logger.info('object.delete.canceled', extra={
                'object_id': organization.id,
                'model': Organization.__name__,
            })
            messages.add_message(request, messages.SUCCESS,
                MSG_RESTORE_SUCCESS)

        return self.redirect(
            reverse('sentry-organization-home', args=[organization.slug])
        )
