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
from sentry.identity.pipeline import IdentityPipeline
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.users.models.identity import Identity, IdentityProvider

logger = logging.getLogger(__name__)

MONITORING_PROVIDERS: dict[str, dict[str, str]] = {
    "datadog": {"name": "Datadog"},
    "gcp": {"name": "Google Cloud Platform"},
}

MONITORING_PROVIDER_FEATURE = "organizations:seer-infra-telemetry"


def _get_pipeline_config(provider_key: str, request_data: dict[str, str]) -> dict[str, str]:
    """Build provider-specific pipeline config from request body."""
    config: dict[str, str] = {}
    if provider_key == "datadog":
        site = request_data.get("site")
        if not site:
            raise ValueError("Datadog requires a 'site' parameter (e.g. 'datadoghq.com').")
        config["site"] = site
    return config


def _get_identity_provider(provider_key: str, config: dict[str, str]) -> IdentityProvider:
    """
    Get or create the IdentityProvider for a monitoring provider.

    Datadog uses per-site providers (external_id=site). GCP uses a single global provider.
    """
    if provider_key == "datadog":
        external_id = config.get("site", "")
    else:
        external_id = ""

    idp, _ = IdentityProvider.objects.get_or_create(type=provider_key, external_id=external_id)
    return idp


@control_silo_endpoint
class OrganizationMonitoringProviderIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: RpcOrganization, **kwargs: object) -> Response:
        if not features.has(MONITORING_PROVIDER_FEATURE, organization, actor=request.user):
            return Response(status=404)

        user_id = request.user.id
        if user_id is None:
            return Response(status=401)

        connected_identities = {
            identity.idp.type: identity
            for identity in Identity.objects.filter(
                idp__type__in=MONITORING_PROVIDERS.keys(),
                user_id=user_id,
            ).select_related("idp")
        }

        providers = []
        for key, meta in MONITORING_PROVIDERS.items():
            identity = connected_identities.get(key)
            entry: dict[str, str | bool] = {
                "provider": key,
                "name": meta["name"],
                "connected": identity is not None,
            }
            if identity is not None:
                email = identity.data.get("email") if identity.data else None
                if email:
                    entry["email"] = email
            providers.append(entry)

        return Response({"providers": providers})


@control_silo_endpoint
class OrganizationMonitoringProviderDetailsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def post(
        self, request: Request, organization: RpcOrganization, provider_key: str, **kwargs: object
    ) -> Response:
        if not features.has(MONITORING_PROVIDER_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if provider_key not in MONITORING_PROVIDERS:
            return Response({"detail": "Unknown monitoring provider."}, status=400)

        try:
            config = _get_pipeline_config(provider_key, request.data)
        except ValueError:
            return Response({"detail": "Invalid provider configuration."}, status=400)

        idp = _get_identity_provider(provider_key, config)

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
        if not features.has(MONITORING_PROVIDER_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if provider_key not in MONITORING_PROVIDERS:
            return Response({"detail": "Unknown monitoring provider."}, status=400)

        user_id = request.user.id
        if user_id is None:
            return Response(status=401)

        identities = list(
            Identity.objects.filter(
                idp__type=provider_key,
                user_id=user_id,
            )
        )

        if not identities:
            return Response({"detail": "Not connected to this provider."}, status=404)

        for identity in identities:
            identity.delete()

        return Response(status=204)
