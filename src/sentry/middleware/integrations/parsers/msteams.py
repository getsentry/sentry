from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from functools import cached_property
from typing import Any

import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.integrations.msteams.webhook import (
    MsTeamsEvents,
    MsTeamsWebhookEndpoint,
    MsTeamsWebhookMixin,
)
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.region import Region, RegionResolutionError
from sentry.utils import json

logger = logging.getLogger(__name__)


class MsTeamsRequestParser(BaseRequestParser, MsTeamsWebhookMixin):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.MSTEAMS]
    webhook_identifier = WebhookProviderIdentifier.MSTEAMS

    region_view_classes = [MsTeamsWebhookEndpoint]

    _synchronous_events = [MsTeamsEvents.INSTALLATION_UPDATE]

    @cached_property
    def request_data(self):
        data = {}
        try:
            data = json.loads(self.request.body.decode(encoding="utf-8"))
        except Exception as err:
            sentry_sdk.capture_exception(err)
        return data

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        integration = self.get_integration_from_card_action(data=self.request_data)
        if integration is None:
            integration = self.get_integration_from_channel_data(data=self.request_data)
        if integration is None:
            integration = self.get_integration_for_tenant(data=self.request_data)
        if integration:
            return Integration.objects.filter(id=integration.id).first()
        return None

    @classmethod
    def _check_if_event_should_be_sync(cls, data: Mapping[str, Any]) -> bool:
        """
        Determine if an event should be handled synchronously, or if we can defer to async.
        """
        raw_event_type = data.get("type", None)
        if raw_event_type is None:
            return True

        event_type = MsTeamsEvents.get_from_value(value=raw_event_type)
        return event_type in cls._synchronous_events

    def get_response(self) -> HttpResponseBase:
        if self.view_class not in self.region_view_classes:
            logger.info(
                "View class not in region",
                extra={"request_data": self.request_data},
            )
            return self.get_response_from_control_silo()

        if not self.can_infer_integration(data=self.request_data):
            logger.info(
                "Could not infer integration",
                extra={"request_data": self.request_data},
            )
            return self.get_response_from_control_silo()

        regions: Sequence[Region] = []
        try:
            integration = self.get_integration_from_request()
            if not integration:
                logger.info(
                    "Could not get integration from request",
                    extra={"request_data": self.request_data},
                )
                return self.get_default_missing_integration_response()

            regions = self.get_regions_from_organizations()
        except (Integration.DoesNotExist, OrganizationIntegration.DoesNotExist) as err:
            logger.info(
                "Error in handling",
                exc_info=err,
                extra={"request_data": self.request_data},
            )
            return self.get_default_missing_integration_response()

        if len(regions) == 0:
            with sentry_sdk.push_scope() as scope:
                scope.set_extra("view_class", self.view_class)
                scope.set_extra("request_method", self.request.method)
                scope.set_extra("request_path", self.request.path)
                # Since self.can_infer_integration is True, we should be able to resolve a non-empty set of regions.
                # If the list of regions is empty, then we need to investigate.
                sentry_sdk.capture_exception(
                    RegionResolutionError(
                        f"Regions list is empty for {self.provider}.request_parser."
                    )
                )
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        if self._check_if_event_should_be_sync(data=self.request_data):
            logger.info(
                "MSTeams event should be handled synchronously",
                extra={"request_data": self.request_data},
            )
            return self.get_response_from_control_silo()

        logger.info(
            "Scheduling event for request",
            extra={"request_data": self.request_data},
        )
        return self.get_response_from_webhookpayload_for_integration(
            regions=regions, integration=integration
        )
