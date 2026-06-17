from __future__ import annotations

import logging

from django.http import HttpResponseRedirect
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
from sentry.identity import default_manager as identity_manager
from sentry.identity.pipeline import IdentityPipeline
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.users.models.identity import Identity, IdentityProvider

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
        try:
            config = provider_type.get_pipeline_config(request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        idp: IdentityProvider | None = None
        if not provider_type.auto_create_provider_model:
            idp, _ = IdentityProvider.objects.get_or_create(type=provider_key, external_id="")

        pipeline = IdentityPipeline(
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

    def delete(
        self, request: Request, organization: RpcOrganization, provider_key: str, **kwargs: object
    ) -> Response:
        if not features.has("organizations:seer-infra-telemetry", organization, actor=request.user):
            return Response(status=404)

        if provider_key not in MONITORING_PROVIDERS:
            return Response({"detail": "Unknown monitoring provider."}, status=400)

        identities = list(
            Identity.objects.filter(
                idp__type=provider_key,
                user_id=request.user.id,  # type: ignore[misc]
            )
        )

        if not identities:
            return Response({"detail": "Not connected to this provider."}, status=404)

        for identity in identities:
            identity.delete()

        return Response(status=204)
