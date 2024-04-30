from __future__ import annotations

import abc
import logging
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, Any

from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import ResolverMatch, resolve
from rest_framework import status

from sentry.api.base import ONE_DAY
from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.models.integrations import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.ratelimits import backend as ratelimiter
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.silo.base import SiloLimit, SiloMode
from sentry.silo.client import RegionSiloClient, SiloClientError
from sentry.types.region import Region, find_regions_for_orgs, get_region_by_name
from sentry.utils import metrics

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


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    @property
    def provider(self) -> str:
        raise NotImplementedError("'provider' property is required by IntegrationClassification")

    @property
    def webhook_identifier(self) -> WebhookProviderIdentifier:
        raise NotImplementedError(
            "'webhook_identifier' property is required for outboxing. Refer to WebhookProviderIdentifier enum."
        )

    def __init__(self, request: HttpRequest, response_handler: ResponseHandler):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.view_class = None
        if hasattr(self.match.func, "view_class"):
            self.view_class = self.match.func.view_class
        self.response_handler = response_handler

    # Common Helpers

    def ensure_control_silo(self):
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            logger.error(
                "silo_error",
                extra={"path": self.request.path, "silo": SiloMode.get_current_mode()},
            )
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
        return self.response_handler(self.request)

    def get_response_from_region_silo(self, region: Region) -> HttpResponseBase:
        with metrics.timer(
            "integration_proxy.control.get_response_from_region_silo",
            tags={"destination_region": region.name},
            sample_rate=1.0,
        ):
            region_client = RegionSiloClient(region, retry=True)
            return region_client.proxy_request(incoming_request=self.request)

    def get_responses_from_region_silos(
        self, regions: Sequence[Region]
    ) -> Mapping[str, RegionResult]:
        """
        Used to handle the requests on a given list of regions (synchronously).
        Returns a mapping of region name to response/exception.
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
                # This will capture errors from this silo and any 4xx/5xx responses from others
                except Exception as e:
                    logger.exception(
                        "region_proxy_error", extra={"region": region.name, "error": e}
                    )
                    region_to_response_map[region.name] = RegionResult(error=e)
                else:
                    region_to_response_map[region.name] = RegionResult(response=region_response)

        if len(region_to_response_map) == 0:
            logger.error(
                "region_no_response",
                extra={"path": self.request.path, "regions": [region.name for region in regions]},
            )
            return region_to_response_map

        return region_to_response_map

    def get_response_from_webhookpayload(
        self,
        regions: Sequence[Region],
        identifier: int | str | None = None,
        integration_id: int | None = None,
    ):
        """
        Used to create webhookpayloads for provided regions to handle the webhooks asynchronously.
        Responds to the webhook provider with a 202 Accepted status.
        """
        if len(regions) < 1:
            return HttpResponse(status=status.HTTP_202_ACCEPTED)

        shard_identifier = identifier or self.webhook_identifier.value
        for region in regions:
            WebhookPayload.create_from_request(
                region=region.name,
                provider=self.provider,
                identifier=shard_identifier,
                integration_id=integration_id,
                request=self.request,
            )

        return HttpResponse(status=status.HTTP_202_ACCEPTED)

    def get_response_from_webhookpayload_for_integration(
        self, regions: Sequence[Region], integration: Integration | RpcIntegration
    ):
        """
        Used to create outboxes for provided regions to handle the webhooks asynchronously.
        Responds to the webhook provider with a 202 Accepted status.
        """
        return self.get_response_from_webhookpayload(
            regions=regions, identifier=integration.id, integration_id=integration.id
        )

    def get_mailbox_identifier(self, integration: RpcIntegration, data: Mapping[str, Any]) -> str:
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
            logger.info(
                "integrations.parser.activate_buckets",
                extra={"provider": self.provider, "integration_id": integration.id},
            )
        if not use_buckets:
            return str(integration.id)

        mailbox_bucket_id = self.mailbox_bucket_id(data)
        if mailbox_bucket_id is None:
            logger.info(
                "integrations.parser.no_bucket_id",
                extra={"provider": self.provider, "integration_id": integration.id},
            )
            return str(integration.id)

        # Split high volume integrations into 100 buckets.
        # 100 is arbitrary but we can't leave it unbounded.
        bucket_number = mailbox_bucket_id % 100

        return f"{integration.id}:{bucket_number}"

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        raise NotImplementedError(
            "You must implement mailbox_bucket_id to use bucketed identifiers"
        )

    def get_response_from_first_region(self):
        regions = self.get_regions_from_organizations()
        first_region = regions[0]
        response_map = self.get_responses_from_region_silos(regions=[first_region])
        region_result = response_map[first_region.name]
        if region_result.error is not None:
            # We want to fail loudly so that devs know this error happened on the region silo (for now)
            error = SiloClientError(region_result.error)
            raise SiloClientError(error)
        return region_result.response

    def get_response_from_all_regions(self):
        regions = self.get_regions_from_organizations()
        response_map = self.get_responses_from_region_silos(regions=regions)
        successful_responses = [
            result for result in response_map.values() if result.response is not None
        ]
        if len(successful_responses) == 0:
            error_map = {region: result.error for region, result in response_map.items()}
            raise SiloClientError("No successful region responses", error_map)
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
        Parse the request to retreive organizations to forward the request to.
        Should be overwritten by implementation.
        """
        return None

    # Optional Overrides

    def get_organizations_from_integration(
        self, integration: Integration | RpcIntegration | None = None
    ) -> Sequence[RpcOrganizationSummary]:
        """
        Use the get_integration_from_request() method to identify organizations associated with
        the integration request.
        """
        if not integration:
            integration = self.get_integration_from_request()
        if not integration:
            logger.info("%s.no_integration", self.provider, extra={"path": self.request.path})
            raise Integration.DoesNotExist()
        organization_integrations = OrganizationIntegration.objects.filter(
            integration_id=integration.id
        )

        if organization_integrations.count() == 0:
            logger.info(
                "%s.no_organization_integrations", self.provider, extra={"path": self.request.path}
            )
            raise OrganizationIntegration.DoesNotExist()
        organization_ids = [oi.organization_id for oi in organization_integrations]
        return organization_mapping_service.get_many(organization_ids=organization_ids)

    def get_regions_from_organizations(
        self, organizations: Sequence[RpcOrganizationSummary] | None = None
    ) -> Sequence[Region]:
        """
        Use the get_organizations_from_integration() method to identify forwarding regions.
        """
        if not organizations:
            organizations = self.get_organizations_from_integration()

        region_names = find_regions_for_orgs([org.id for org in organizations])
        return sorted([get_region_by_name(name) for name in region_names], key=lambda r: r.name)

    def get_default_missing_integration_response(self) -> HttpResponse:
        return HttpResponse(status=400)
