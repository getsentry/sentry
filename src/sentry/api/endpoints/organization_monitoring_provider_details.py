from __future__ import annotations

import logging

from django.db import IntegrityError
from django.http import HttpResponseRedirect
from requests.exceptions import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.endpoints.organization_monitoring_provider_index import (
    MONITORING_PROVIDERS,
    MonitoringProviderPermission,
)
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity import default_manager as identity_manager
from sentry.identity.base import Provider
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.pipeline import MonitoringIdentityPipeline
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.users.models.identity import Identity, IdentityProvider, OrganizationIdentity

logger = logging.getLogger(__name__)


@control_silo_endpoint
class OrganizationMonitoringProviderDetailsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (MonitoringProviderPermission,)

    def post(
        self, request: Request, organization: RpcOrganization, provider_key: str, **kwargs: object
    ) -> Response:
        if not features.has("organizations:seer-infra-telemetry", organization, actor=request.user):
            return Response(status=404)

        if provider_key not in MONITORING_PROVIDERS:
            return Response({"detail": "Unknown monitoring provider."}, status=400)

        provider_type = identity_manager.get(provider_key)

        # For token-based providers without OAuth flow, verify the submitted token
        # and link the identity directly instead of redirecting.
        if not isinstance(provider_type, OAuth2Provider):
            return self._link_submitted_token(request, provider_type, organization)

        try:
            config = provider_type.get_pipeline_config(request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        idp: IdentityProvider | None = None
        if not provider_type.auto_create_provider_model:
            idp, _ = IdentityProvider.objects.get_or_create(type=provider_key, external_id="")

        pipeline = MonitoringIdentityPipeline(
            request=request._request,
            provider_key=provider_key,
            organization=organization,
            provider_model=idp,
            config=config,
        )
        pipeline.initialize()

        response = pipeline.current_step()

        if isinstance(response, HttpResponseRedirect):
            return Response({"redirectUrl": response.url})

        logger.error(
            "monitoring_provider.connect.unexpected_response",
            extra={"provider": provider_key, "response_type": type(response).__name__},
        )
        return Response({"detail": "Failed to start OAuth flow."}, status=500)

    def _link_submitted_token(
        self, request: Request, provider_type: Provider, organization: RpcOrganization
    ) -> Response:
        """Verify a user-submitted token and link the identity (no OAuth flow)."""
        try:
            identity = provider_type.build_identity(request.data)
        except (ValueError, IdentityNotValid) as e:
            return Response({"detail": str(e)}, status=400)
        except RequestException:
            return Response({"detail": "Failed to verify token with provider."}, status=400)

        idp, _ = IdentityProvider.objects.get_or_create(
            type=identity["type"],
            external_id=identity["idp_external_id"],
            defaults={"config": identity.get("idp_config", {})},
        )

        try:
            linked_identity = Identity.objects.link_identity(
                user=request.user,  # type: ignore[arg-type]
                idp=idp,
                external_id=identity["id"],
                should_reattach=False,
                defaults={
                    "scopes": identity.get("scopes", []),
                    "data": identity.get("data", {}),
                },
            )
        except IntegrityError:
            return Response({"detail": "This account is already connected."}, status=409)

        if linked_identity:
            OrganizationIdentity.objects.get_or_create(
                organization_id=organization.id,
                identity=linked_identity,
            )

        return Response(status=204)

    def delete(
        self, request: Request, organization: RpcOrganization, provider_key: str, **kwargs: object
    ) -> Response:
        if not features.has("organizations:seer-infra-telemetry", organization, actor=request.user):
            return Response(status=404)

        if provider_key not in MONITORING_PROVIDERS:
            return Response({"detail": "Unknown monitoring provider."}, status=400)

        org_identities = list(
            OrganizationIdentity.objects.filter(
                organization_id=organization.id,
                identity__user_id=request.user.id,  # type: ignore[misc]
                identity__idp__type=provider_key,
            ).select_related("identity")
        )

        if not org_identities:
            return Response({"detail": "Not connected to this provider."}, status=404)

        for org_identity in org_identities:
            identity = org_identity.identity
            org_identity.delete()
            if not OrganizationIdentity.objects.filter(identity=identity).exists():
                identity.delete()

        return Response(status=204)
