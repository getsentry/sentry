import logging

from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.models import AuditLogEntryEvent, Integration, Organization, OrganizationIntegration
from sentry.utils.audit import create_audit_entry

logger = logging.getLogger("sentry.integrations.vercel.uninstall")


class VercelUninstallEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request):
        # userId should always be present
        external_id = request.data.get("teamId") or request.data.get("userId")
        configuration_id = request.data["payload"]["configuration"]["id"]

        return self._delete(external_id, configuration_id, request)

    def delete(self, request):
        # userId should always be present
        external_id = request.data.get("teamId") or request.data.get("userId")
        configuration_id = request.data.get("configurationId")

        return self._delete(external_id, configuration_id, request)

    def _delete(self, external_id, configuration_id, request):
        try:
            integration = Integration.objects.get(provider="vercel", external_id=external_id)
        except Integration.DoesNotExist:
            logger.info(
                "vercel.uninstall.missing-integration",
                extra={"configuration_id": configuration_id, "external_id": external_id},
            )
            return self.respond(status=404)

        orgs = integration.organizations.all()

        if len(orgs) == 0:
            # we already deleted the organization integration and
            # there was only one to begin with
            integration.delete()
            return self.respond(status=204)

        configuration = integration.metadata["configurations"].pop(configuration_id)
        # one of two cases:
        #  1.) someone is deleting from vercel's end and we still need to delete the
        #      organization integration AND the integration (since there is only one)
        #  2.) we already deleted the organization integration tied to this configuration
        #      and the remaining one is for a different org (and configuration)
        if len(orgs) == 1:
            try:
                # Case no. 1: do the deleting and return
                OrganizationIntegration.objects.get(
                    organization_id=configuration["organization_id"], integration_id=integration.id
                )
                create_audit_entry(
                    request=request,
                    organization=orgs[0],
                    target_object=integration.id,
                    event=AuditLogEntryEvent.INTEGRATION_REMOVE,
                    actor_label="Vercel User",
                    data={"provider": integration.provider, "name": integration.name},
                )
                integration.delete()
                return self.respond(status=204)
            except OrganizationIntegration.DoesNotExist:
                # Case no. 2: continue onto updating integration.metadata
                logger.info(
                    "vercel.uninstall.org-integration-already-deleted",
                    extra={
                        "configuration_id": configuration_id,
                        "external_id": external_id,
                        "integration_id": integration.id,
                        "organization_id": configuration["organization_id"],
                    },
                )

        if configuration_id == integration.metadata["installation_id"]:
            # if we are uninstalling a primary configuration, and there are
            # multiple orgs connected to this integration we must update
            # the crendentials (access_token, webhook_id etc)
            next_config_id, next_config = list(integration.metadata["configurations"].items())[0]

            integration.metadata["access_token"] = next_config["access_token"]
            integration.metadata["webhook_id"] = next_config["webhook_id"]
            integration.metadata["installation_id"] = next_config_id

        integration.save()

        # At this point we can consider if len(orgs) > 1. We have already updated the
        # integration.metadata, but we may not have deleted the OrganizationIntegration
        try:
            OrganizationIntegration.objects.get(
                organization_id=configuration["organization_id"], integration_id=integration.id
            ).delete()

            organization = Organization.objects.get(id=configuration["organization_id"])
            create_audit_entry(
                request=request,
                organization=organization,
                target_object=integration.id,
                event=AuditLogEntryEvent.INTEGRATION_REMOVE,
                actor_label="Vercel User",
                data={"provider": integration.provider, "name": integration.name},
            )
        except OrganizationIntegration.DoesNotExist:
            logger.info(
                "vercel.uninstall.org-integration-already-deleted",
                extra={
                    "configuration_id": configuration_id,
                    "external_id": external_id,
                    "integration_id": integration.id,
                    "organization_id": configuration["organization_id"],
                },
            )

        return self.respond(status=204)
