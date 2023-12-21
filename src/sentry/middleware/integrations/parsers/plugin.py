from __future__ import annotations

import logging
from typing import Any

from django.http import HttpResponse

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.types.region import RegionResolutionError, get_region_by_name
from sentry_plugins.bitbucket.endpoints.webhook import BitbucketPluginWebhookEndpoint
from sentry_plugins.github.webhooks.non_integration import GithubPluginWebhookEndpoint

logger = logging.getLogger(__name__)


class PluginRequestParser(BaseRequestParser):
    provider = "plugins"
    webhook_identifier = WebhookProviderIdentifier.LEGACY_PLUGIN

    def should_operate(self) -> bool:
        return self.view_class in {BitbucketPluginWebhookEndpoint, GithubPluginWebhookEndpoint}

    def get_response(self):
        """
        Used for identifying regions from Github and Bitbucket plugin webhooks
        """
        organization_id = self.match.kwargs.get("organization_id")
        logging_extra: dict[str, Any] = {"path": self.request.path}
        if not organization_id:
            logger.info("%s.no_organization_id", self.provider, extra=logging_extra)
            return self.get_response_from_control_silo()

        try:
            mapping: OrganizationMapping = OrganizationMapping.objects.get(
                organization_id=organization_id
            )
        except OrganizationMapping.DoesNotExist as e:
            logging_extra["error"] = str(e)
            logging_extra["organization_id"] = organization_id
            logger.info("%s.no_mapping", self.provider, extra=logging_extra)

            # Webhook was for an org and that org no longer exists.
            return HttpResponse(status=400)

        try:
            region = get_region_by_name(mapping.region_name)
        except RegionResolutionError as e:
            logging_extra["error"] = str(e)
            logging_extra["mapping_id"] = mapping.id
            logger.info("%s.no_region", self.provider, extra=logging_extra)
            return self.get_response_from_control_silo()
        return self.get_response_from_outbox_creation(regions=[region])
