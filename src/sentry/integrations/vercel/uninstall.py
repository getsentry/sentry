from __future__ import absolute_import

import logging

from django.views.decorators.csrf import csrf_exempt
from sentry.api.base import Endpoint
from sentry.models import AuditLogEntryEvent, Integration, OrganizationIntegration, Organization
from sentry.utils.audit import create_audit_entry
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.vercel.uninstall")


class VercelUninstallEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(VercelUninstallEndpoint, self).dispatch(request, *args, **kwargs)

    @transaction_start("VercelUninstallEndpoint")
    def delete(self, request):
        # userId should always be present
        external_id = request.data.get("teamId") or request.data.get("userId")
        configuration_id = request.data.get("configurationId")

        try:
            integration = Integration.objects.get(provider="vercel", external_id=external_id)
        except Integration.DoesNotExist:
            logger.info(
                "vercel.uninstall.missing-integration",
                extra={"configuration_id": configuration_id, "external_id": external_id},
            )
            return self.respond(status=404)

        orgs = integration.organizations.all()

        if len(orgs) == 1:
            create_audit_entry(
                request=request,
                organization=orgs[0],
                target_object=integration.id,
                event=AuditLogEntryEvent.INTEGRATION_REMOVE,
                # TODO(meredith): If we create vercel identities from the userId
                # we could attempt to find the user in Sentry and pass that in for
                # the actor instead.
                actor_label="Vercel User",
                data={"provider": integration.provider, "name": integration.name},
            )
            integration.delete()
            return self.respond(status=204)

        configuration = integration.metadata["configurations"].pop(configuration_id)
        if configuration_id == integration.metadata["installation_id"]:
            # if we are uninstalling a primary configuration, and there are
            # multiple orgs connected to this integration we must update
            # the crendentials (access_token, webhook_id etc)
            next_config_id, next_config = list(integration.metadata["configurations"].items())[0]

            integration.metadata["access_token"] = next_config["access_token"]
            integration.metadata["webhook_id"] = next_config["webhook_id"]
            integration.metadata["installation_id"] = next_config_id

        try:
            OrganizationIntegration.objects.get(
                organization_id=configuration["organization_id"], integration_id=integration.id
            ).delete()
        except OrganizationIntegration.DoesNotExist:
            logger.error(
                "vercel.uninstall.missing-org-integration",
                extra={
                    "configuration_id": configuration_id,
                    "external_id": external_id,
                    "integration_id": integration.id,
                    "organization_id": configuration["organization_id"],
                },
            )
            return self.respond(status=404)

        integration.save()

        organization = Organization.objects.get(id=configuration["organization_id"])
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=integration.id,
            event=AuditLogEntryEvent.INTEGRATION_REMOVE,
            # TODO(meredith): If we create vercel identities from the userId
            # we could attempt to find the user in Sentry and pass that in for
            # the actor instead.
            actor_label="Vercel User",
            data={"provider": integration.provider, "name": integration.name},
        )

        return self.respond(status=204)
