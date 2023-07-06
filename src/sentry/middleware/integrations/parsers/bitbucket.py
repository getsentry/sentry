from __future__ import annotations

import logging

from sentry.integrations.bitbucket import BitbucketWebhookEndpoint
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.types.region import get_region_by_name

logger = logging.getLogger(__name__)


class BitbucketRequestParser(BaseRequestParser):
    provider = "bitbucket"
    webhook_identifier = WebhookProviderIdentifier.BITBUCKET

    def get_bitbucket_webhook_response(self):
        # The organization is provided in the path, so we can skip inferring organizations
        # from the integration credentials
        organization_id = self.match.kwargs.get("organization_id")
        logging_extra = {"path": self.request.path}
        if not organization_id:
            logger.info("no_organization_id", extra=logging_extra)
            return self.get_response_from_control_silo()

        mapping: OrganizationMapping = OrganizationMapping.objects.get(
            organization_id=organization_id
        )
        if not mapping:
            logging_extra["organization_id"] = organization_id
            logger.info("no_mapping", extra=logging_extra)
            return self.get_response_from_control_silo()

        region = get_region_by_name(mapping.region_name)
        if not region:
            logging_extra["mapping_id"] = mapping.id
            logger.info("no_region", extra=logging_extra)
            return self.get_response_from_control_silo()
        return self.get_response_from_outbox_creation(regions=[region])

    def get_response(self):
        view_class = self.match.func.view_class  # type: ignore
        if view_class == BitbucketWebhookEndpoint:
            return self.get_bitbucket_webhook_response()
        return self.get_response_from_control_silo()
