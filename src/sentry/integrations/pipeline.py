from __future__ import annotations

import logging

from django.db import IntegrityError
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.translation import gettext as _

from sentry import features
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.integrations.manager import default_manager
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import organization_service
from sentry.pipeline import Pipeline, PipelineAnalyticsEntry
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationProviderError
from sentry.silo.base import SiloMode
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.utils import metrics
from sentry.web.helpers import render_to_response

__all__ = ["IntegrationPipeline"]

logger = logging.getLogger(__name__)


def ensure_integration(key, data):
    defaults = {
        "metadata": data.get("metadata", {}),
        "name": data.get("name", data["external_id"]),
        "status": ObjectStatus.ACTIVE,
    }
    integration, created = Integration.objects.get_or_create(
        provider=key, external_id=data["external_id"], defaults=defaults
    )
    if not created:
        integration.update(**defaults)

    return integration


def is_violating_region_restriction(organization_id: int, integration_id: int):
    """
    Returns True if the organization_id provided does NOT reside within the same region as other
    organizations which have installed the provided integration.
    """
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return False

    ois = OrganizationIntegration.objects.filter(integration_id=integration_id)
    if len(ois) == 0:
        return False

    logger_extra = {
        "integration_id": integration_id,
        "organization_id": organization_id,
    }

    organization_ids = {oi.organization_id for oi in ois}
    region_names = (
        OrganizationMapping.objects.filter(organization_id__in=organization_ids)
        .values_list("region_name", flat=True)
        .distinct()
    )

    if len(region_names) > 1:
        logger.error("region_violation", extra={"regions": region_names, **logger_extra})

    try:
        mapping = OrganizationMapping.objects.get(organization_id=organization_id)
    except OrganizationMapping.DoesNotExist:
        logger.exception("mapping_missing", extra=logger_extra)
        return True

    return mapping.region_name not in region_names


class IntegrationPipeline(Pipeline):
    pipeline_name = "integration_pipeline"
    provider_manager = default_manager

    def get_analytics_entry(self) -> PipelineAnalyticsEntry | None:
        pipeline_type = "reauth" if self.fetch_state("integration_id") else "install"
        return PipelineAnalyticsEntry("integrations.pipeline_step", pipeline_type)

    def initialize(self) -> None:
        super().initialize()

        metrics.incr(
            "sentry.integrations.installation_attempt", tags={"integration": self.provider.key}
        )

    def finish_pipeline(self):
        org_context = organization_service.get_organization_by_id(
            id=self.organization.id, user_id=self.request.user.id
        )

        if (
            org_context
            and org_context.member
            and "org:integrations" not in org_context.member.scopes
        ):
            error_message = (
                "You must be an organization owner, manager or admin to install this integration."
            )
            logger.info(
                "build-integration.permission_error",
                extra={
                    "error_message": error_message,
                    "organization_id": self.organization.id if self.organization else None,
                    "user_id": self.request.user.id,
                    "provider_key": self.provider.key,
                },
            )
            return self.error(error_message)

        try:
            data = self.provider.build_integration(self.state.data)
        except IntegrationError as e:
            self.get_logger().info(
                "build-integration.failure",
                extra={
                    "error_message": str(e),
                    "error_status": getattr(e, "code", None),
                    "organization_id": self.organization.id if self.organization else None,
                    "provider_key": self.provider.key,
                },
            )
            return self.error(str(e))
        except IntegrationProviderError as e:
            self.get_logger().info(
                "build-integration.provider-error",
                extra={
                    "error_message": str(e),
                    "error_status": getattr(e, "code", None),
                    "organization_id": self.organization.id if self.organization else None,
                    "provider_key": self.provider.key,
                },
            )
            return self.render_warning(str(e))

        response = self._finish_pipeline(data)

        extra = data.get("post_install_data")

        self.provider.create_audit_log_entry(
            self.integration, self.organization, self.request, "install", extra=extra
        )
        self.provider.post_install(self.integration, self.organization, extra=extra)
        self.clear_session()

        metrics.incr(
            "sentry.integrations.installation_finished", tags={"integration": self.provider.key}
        )

        return response

    def _finish_pipeline(self, data):
        if "expect_exists" in data:
            self.integration = Integration.objects.get(
                provider=self.provider.integration_key, external_id=data["external_id"]
            )
        else:
            self.integration = ensure_integration(self.provider.integration_key, data)

        # Does this integration provide a user identity for the user setting up
        # the integration?
        identity = data.get("user_identity")
        identity_model = None
        if identity:
            # Some identity providers may not be directly associated to the
            # external integration. Integrations may specify the external_id to
            # be used for the idp.
            idp_external_id = data.get("idp_external_id", data["external_id"])
            idp_config = data.get("idp_config", {})

            # Create identity provider for this integration if necessary
            idp, created = IdentityProvider.objects.get_or_create(
                external_id=idp_external_id, type=identity["type"], defaults={"config": idp_config}
            )
            if not created:
                idp.update(config=idp_config)

            identity_data = {
                "status": IdentityStatus.VALID,
                "scopes": identity["scopes"],
                "data": identity["data"],
                "date_verified": timezone.now(),
            }

            try:
                identity_model = Identity.objects.link_identity(
                    user=self.request.user,
                    idp=idp,
                    external_id=identity["external_id"],
                    should_reattach=False,
                    defaults=identity_data,
                )
            except IntegrityError:
                # If the external_id is already used for a different user then throw an error
                # otherwise we have the same user with a new external id
                # and we update the identity with the new external_id and identity data
                try:
                    matched_identity = Identity.objects.get(
                        idp=idp, external_id=identity["external_id"]
                    )
                except Identity.DoesNotExist:
                    # The user is linked to a different external_id. It's ok to relink
                    # here because they'll still be able to log in with the new external_id.
                    identity_model = Identity.objects.update_external_id_and_defaults(
                        idp, identity["external_id"], self.request.user, identity_data
                    )
                else:
                    self.get_logger().info(
                        "finish_pipeline.identity_linked_different_user",
                        extra={
                            "idp_id": idp.id,
                            "external_id": identity["external_id"],
                            "object_id": matched_identity.id,
                            "user_id": self.request.user.id,
                            "type": identity["type"],
                            "organization_id": self.organization.id if self.organization else None,
                            "provider_key": self.provider.key,
                        },
                    )
                    # if we don't need a default identity, we don't have to throw an error
                    if self.provider.needs_default_identity:
                        # The external_id is linked to a different user.
                        proper_name = idp.get_provider().name
                        return self._dialog_response(
                            {
                                "error": _(
                                    "The provided %(proper_name)s account is linked to a different Sentry user. "
                                    "To continue linking the current Sentry user, please use a different %(proper_name)s account."
                                )
                                % ({"proper_name": proper_name})
                            },
                            False,
                        )

        default_auth_id = None
        if self.provider.needs_default_identity:
            if not (identity and identity_model):
                raise NotImplementedError("Integration requires an identity")
            default_auth_id = identity_model.id
        if self.provider.is_region_restricted and is_violating_region_restriction(
            organization_id=self.organization.id, integration_id=self.integration.id
        ):
            self.get_logger().info(
                "finish_pipeline.multi_region_install_error",
                extra={
                    "organization_id": self.organization.id if self.organization else None,
                    "provider_key": self.provider.key,
                    "integration_id": self.integration.id,
                },
            )
            return self.error(
                "This integration has already been installed on another Sentry organization which resides in a different region. Installation could not be completed."
            )

        org_integration = self.integration.add_organization(
            self.organization, self.request.user, default_auth_id=default_auth_id
        )

        extra = data.get("post_install_data", {})
        # If a particular provider has a redirect for a successful install, use that instead of the generic success
        redirect_url_format = extra.get("redirect_url_format", None)
        if redirect_url_format is not None:
            return self._get_redirect_response(redirect_url_format=redirect_url_format)
        return self._dialog_success(org_integration)

    def _dialog_success(self, org_integration):
        return self._dialog_response(serialize(org_integration, self.request.user), True)

    def _dialog_response(self, data, success):
        document_origin = "document.origin"
        if features.has("system:multi-region"):
            document_origin = f'"{generate_organization_url(self.organization.slug)}"'
        context = {
            "payload": {"success": success, "data": data},
            "document_origin": document_origin,
        }
        self.get_logger().info(
            "dialog_response",
            extra={
                "document_origin": document_origin,
                "success": success,
                "organization_id": self.organization.id if self.organization else None,
                "provider_key": self.provider.key,
                "dialog": data,
            },
        )
        return render_to_response("sentry/integrations/dialog-complete.html", context, self.request)

    def _get_redirect_response(self, redirect_url_format: str) -> HttpResponseRedirect:
        redirect_url = redirect_url_format.format(org_slug=self.organization.slug)
        return HttpResponseRedirect(redirect_url)
