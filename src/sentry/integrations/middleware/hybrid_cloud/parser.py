from __future__ import annotations

import logging
from abc import ABC
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, Any, ClassVar

from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import ResolverMatch, resolve
from rest_framework import status

import sentry.options as options
from sentry.api.base import ONE_DAY
from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.webhookpayload import DestinationType, WebhookPayload
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.integrations.middleware.metrics import (
    MiddlewareHaltReason,
    MiddlewareOperationEvent,
    MiddlewareOperationType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.ratelimits import backend as ratelimiter
from sentry.silo.base import SiloLimit, SiloMode
from sentry.silo.client import RegionSiloClient, SiloClientError
from sentry.types.region import Region, find_regions_for_orgs, get_region_by_name
from sentry.utils import metrics
from sentry.utils.options import sample_modulo

logger = logging.getLogger(__name__)
if TYPE_CHECKING:
    from sentry.middleware.integrations.integration_control import ResponseHandler


def create_async_request_payload(request: HttpRequest) -> dict[str, Any]:
    return {
        "method": request.method,
        "path": request.get_full_path(),
        "uri": request.build_absolute_uri(),
        "headers": {k: v for k, v in request.headers.items()},
        "body": request.body.decode(encoding="utf-8"),
    }


class RegionResult:
    def __init__(
        self,
        response: HttpResponseBase | None = None,
        error: Exception | None = None,
    ):
        self.response = response
        self.error = error


class BaseRequestParser(ABC):
    """Base Class for Integration Request Parsers"""

    provider: ClassVar[str]
    """The integration provider identifier"""

    webhook_identifier: ClassVar[WebhookProviderIdentifier]
    """The webhook provider identifier"""

    def __init__(self, request: HttpRequest, response_handler: ResponseHandler):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.view_class = None
        if hasattr(self.match.func, "view_class"):
            self.view_class = self.match.func.view_class
        self.response_handler = response_handler

    # Common Helpers

    def ensure_control_silo(self):
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.ENSURE_CONTROL_SILO,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                    "silo": SiloMode.get_current_mode().value,
                }
            )
            if SiloMode.get_current_mode() != SiloMode.CONTROL:
                raise SiloLimit.AvailabilityError(
                    "Integration Request Parsers should only be run on the control silo."
                )

    def is_json_request(self) -> bool:
        if not self.request.headers:
            return False
        return "application/json" in self.request.headers.get("Content-Type", "")

    #  Silo Response Helpers

    def get_response_from_control_silo(self) -> HttpResponseBase:
        """
        Used to handle the request directly on the control silo.
        """
        self.ensure_control_silo()

        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_CONTROL_RESPONSE,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extra("path", self.request.path)
            response = self.response_handler(self.request)
            return response

    def get_response_from_region_silo(self, region: Region) -> HttpResponseBase:
        with metrics.timer(
            "integration_proxy.control.get_response_from_region_silo",
            tags={"destination_region": region.name},
            sample_rate=1.0,
        ):
            region_client = RegionSiloClient(region, retry=True)
            with MiddlewareOperationEvent(
                operation_type=MiddlewareOperationType.GET_REGION_RESPONSE,
                integration_name=self.provider,
                region=region.name,
            ).capture() as lifecycle:
                lifecycle.add_extras(
                    {
                        "path": self.request.path,
                        "region": region.name,
                    }
                )

                http_response = region_client.proxy_request(incoming_request=self.request)
                return http_response

    def get_responses_from_region_silos(self, regions: list[Region]) -> dict[str, RegionResult]:
        """
        Used to handle the requests on a given list of regions (synchronously).
        Returns a dict of region name to response/exception.
        """
        self.ensure_control_silo()

        region_to_response_map = {}

        with ThreadPoolExecutor(max_workers=len(regions)) as executor:
            future_to_region = {
                executor.submit(self.get_response_from_region_silo, region): region
                for region in regions
            }
            for future in as_completed(future_to_region):
                region = future_to_region[future]
                try:
                    region_response = future.result()
                except Exception as e:
                    region_to_response_map[region.name] = RegionResult(error=e)
                else:
                    region_to_response_map[region.name] = RegionResult(response=region_response)

        return region_to_response_map

    def get_response_from_webhookpayload(
        self,
        regions: list[Region],
        identifier: int | str | None = None,
        integration_id: int | None = None,
    ) -> HttpResponseBase:
        """
        Used to create webhookpayloads for provided regions to handle the webhooks asynchronously.
        Responds to the webhook provider with a 202 Accepted status.
        """
        if len(regions) < 1:
            return HttpResponse(status=status.HTTP_202_ACCEPTED)

        shard_identifier = identifier or self.webhook_identifier.value
        for region in regions:
            WebhookPayload.create_from_request(
                destination_type=DestinationType.SENTRY_REGION,
                region=region.name,
                provider=self.provider,
                identifier=shard_identifier,
                integration_id=integration_id,
                request=self.request,
            )

        return HttpResponse(status=status.HTTP_202_ACCEPTED)

    def get_mailbox_identifier(
        self, integration: RpcIntegration | Integration, data: dict[str, Any]
    ) -> str:
        """
        Used by integrations with higher hook volumes to create smaller mailboxes
        that can be delivered in parallel. Requires the integration to implement
        `mailbox_bucket_id`
        """
        # If we get fewer than 3000 in 1 hour we don't need to split into buckets
        ratelimit_key = f"webhookpayload:{self.provider}:{integration.id}"
        use_buckets_key = f"{ratelimit_key}:use_buckets"

        use_buckets = cache.get(use_buckets_key)
        if not use_buckets and ratelimiter.is_limited(
            key=ratelimit_key, window=60 * 60, limit=3000
        ):
            # Once we have gone over the rate limit in a day, we use smaller
            # buckets for the next day.
            cache.set(use_buckets_key, 1, timeout=ONE_DAY)
            use_buckets = True
        if not use_buckets:
            metrics.incr(
                "hybridcloud.webhookpayload.mailbox_routing",
                tags={"provider": self.provider, "bucketed": "false"},
            )
            return str(integration.id)

        return self._build_bucketed_identifier(integration, data)

    def _build_bucketed_identifier(
        self, integration: RpcIntegration | Integration, data: dict[str, Any]
    ) -> str:
        """Compute a sub-mailbox identifier from mailbox_bucket_id, falling back to
        the integration-level mailbox when no bucket ID is available."""
        mailbox_bucket_id = self.mailbox_bucket_id(data)
        if mailbox_bucket_id is None:
            metrics.incr(
                "hybridcloud.webhookpayload.mailbox_routing",
                tags={"provider": self.provider, "bucketed": "false"},
            )
            return str(integration.id)

        # Split high volume integrations into 100 buckets.
        # 100 is arbitrary but we can't leave it unbounded.
        bucket_number = mailbox_bucket_id % 100
        metrics.incr(
            "hybridcloud.webhookpayload.mailbox_routing",
            tags={"provider": self.provider, "bucketed": "true"},
        )

        return f"{integration.id}:{bucket_number}"

    def mailbox_bucket_id(self, data: dict[str, Any]) -> int | None:
        raise NotImplementedError(
            "You must implement mailbox_bucket_id to use bucketed identifiers"
        )

    def get_response_from_first_region(self):
        regions = self.get_regions_from_organizations()
        first_region = regions[0]
        response_map = self.get_responses_from_region_silos(regions=[first_region])
        region_result = response_map[first_region.name]
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_RESPONSE_FROM_FIRST_REGION,
            integration_name=self.provider,
            region=first_region.name,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                    "region": first_region.name,
                }
            )
            if region_result.error is not None:
                # We want to fail loudly so that devs know this error happened on the region silo (for now)
                raise SiloClientError(region_result.error)
            return region_result.response

    def get_response_from_all_regions(self):
        regions = self.get_regions_from_organizations()
        response_map = self.get_responses_from_region_silos(regions=regions)
        successful_responses = [
            result for result in response_map.values() if result.response is not None
        ]
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_RESPONSE_FROM_ALL_REGIONS,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extra("path", self.request.path)
            if len(successful_responses) == 0:
                error_map_str = ", ".join(
                    f"{region}: {result.error}" for region, result in response_map.items()
                )
                raise SiloClientError("No successful region responses", error_map_str)
            return successful_responses[0].response

    # Required Overrides

    def get_response(self) -> HttpResponseBase:
        """
        Used to surface a response as part of the middleware.
        Should be overwritten by implementation.
        Default behaviour is handle the response ignoring SiloMode.
        """
        return self.response_handler(self.request)

    def get_integration_from_request(self) -> Integration | None:
        """
        Parse the request to retrieve integration the request pertains to.
        Should be overwritten by implementation.
        """
        return None

    # Optional Overrides

    def get_organizations_from_integration(
        self, integration: Integration | RpcIntegration | None = None
    ) -> list[RpcOrganizationMapping]:
        """
        Use the get_integration_from_request() method to identify organizations associated with
        the integration request.
        """
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_ORGS_FROM_INTEGRATION,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                }
            )
            if not integration:
                integration = self.get_integration_from_request()
            if not integration:
                raise Integration.DoesNotExist()

            lifecycle.add_extra("integration_id", integration.id)

            organization_integrations = OrganizationIntegration.objects.filter(
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
            )

            if organization_integrations.count() == 0:
                lifecycle.record_halt(
                    halt_reason=MiddlewareHaltReason.ORG_INTEGRATION_DOES_NOT_EXIST
                )
                return []

            organization_ids = [oi.organization_id for oi in organization_integrations]
            all_organizations = organization_mapping_service.get_many(
                organization_ids=organization_ids
            )

            # Integrations will attempt to target a specific organization
            return self.filter_organizations_from_request(organizations=all_organizations)

    def filter_organizations_from_request(
        self,
        organizations: list[RpcOrganizationMapping],
    ) -> list[RpcOrganizationMapping]:
        """
        Parse the request to retrieve the organization to forward the request to.
        Should be overwritten by implementation.
        """
        return organizations

    def get_regions_from_organizations(
        self, organizations: list[RpcOrganizationMapping] | None = None
    ) -> list[Region]:
        """
        Use the get_organizations_from_integration() method to identify forwarding regions.
        """
        if not organizations:
            organizations = self.get_organizations_from_integration()

        if len(organizations) == 0:
            return []

        region_names = find_regions_for_orgs([org.id for org in organizations])
        return sorted([get_region_by_name(name) for name in region_names], key=lambda r: r.name)

    def get_default_missing_integration_response(self) -> HttpResponse:
        return HttpResponse(status=status.HTTP_400_BAD_REQUEST)

    # Forwarding Helpers

    def forward_to_codecov(
        self,
        external_id: str | None = None,
    ):
        rollout_rate = options.get("codecov.forward-webhooks.rollout")

        # we don't want to emit metrics unless we've started to roll this out
        if not rollout_rate:
            return

        if not settings.CODECOV_API_BASE_URL:
            metrics.incr("codecov.forward-webhooks.no-base-url")
            return

        if not external_id:
            metrics.incr("codecov.forward-webhooks.missing-external")
            return

        try:
            installation_id = int(external_id)
        except ValueError:
            metrics.incr("codecov.forward-webhooks.installation-id-not-integer")
            return

        if sample_modulo("codecov.forward-webhooks.rollout", installation_id, granularity=100000):
            shard_identifier = f"codecov:{external_id}"

            # create webhookpayloads for each service
            WebhookPayload.create_from_request(
                destination_type=DestinationType.CODECOV,
                region=None,
                provider=self.provider,
                identifier=shard_identifier,
                integration_id=None,
                request=self.request,
            )
