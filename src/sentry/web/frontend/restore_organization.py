import logging

from django.contrib import messages
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _

from sentry import audit_log
from sentry.api import client
from sentry.models import Organization, OrganizationStatus
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.web.frontend.base import OrganizationView
from sentry.web.helpers import render_to_response

ERR_MESSAGES = {
    OrganizationStatus.ACTIVE: _("Deletion already canceled."),
    OrganizationStatus.DELETION_IN_PROGRESS: _("Deletion cannot be canceled, already in progress"),
}

MSG_RESTORE_SUCCESS = _("Organization restored successfully.")

delete_logger = logging.getLogger("sentry.deletions.ui")


from rest_framework.request import Request
from rest_framework.response import Response


class RestoreOrganizationView(OrganizationView):
    required_scope = "org:admin"
    sudo_required = True

    def determine_active_organization(self, request: Request, organization_slug=None) -> None:
        # A simplified version than what comes from the base
        # OrganizationView. We need to grab an organization
        # that is in any state, not just VISIBLE.
        organization = organization_service.get_organization_by_slug(
            user_id=request.user.id, slug=organization_slug, only_visible=False
        )
        if organization and organization.member:
            self.active_organization = organization
        else:
            self.active_organization = None

    def get(self, request: Request, organization) -> Response:
        if organization.status == OrganizationStatus.ACTIVE:
            return self.redirect(Organization.get_url(organization.slug))

        context = {
            # If this were named 'organization', it triggers logic in the base
            # template to render organization related content, which isn't relevant
            # here.
            "deleting_organization": organization,
            "pending_deletion": organization.status == OrganizationStatus.PENDING_DELETION,
        }

        return render_to_response("sentry/restore-organization.html", context, self.request)

    def post(self, request: Request, organization) -> Response:
        deletion_statuses = [
            OrganizationStatus.PENDING_DELETION,
            OrganizationStatus.DELETION_IN_PROGRESS,
        ]

        if organization.status not in deletion_statuses:
            messages.add_message(request, messages.ERROR, ERR_MESSAGES[organization.status])
            return self.redirect(reverse("sentry"))

        updated = Organization.objects.filter(
            id=organization.id, status__in=deletion_statuses
        ).update(status=OrganizationStatus.ACTIVE)
        if updated:
            client.put(
                f"/organizations/{organization.slug}/",
                data={"cancelDeletion": True},
                request=request,
            )
            messages.add_message(request, messages.SUCCESS, MSG_RESTORE_SUCCESS)
            if organization.status == OrganizationStatus.PENDING_DELETION:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=audit_log.get_event_id("ORG_RESTORE"),
                    data=organization.get_audit_log_data(),
                )
        return self.redirect(Organization.get_url(organization.slug))
