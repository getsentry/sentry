from __future__ import annotations

import logging

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.models import Organization, OrganizationOption

from .base import GithubWebhookBase

logger = logging.getLogger("sentry.webhooks")


class GithubWebhookEndpoint(GithubWebhookBase):
    def get_logging_data(self, organization):
        return {"organization_id": organization.id}

    def get_secret(self, organization: Organization) -> str | None:
        return OrganizationOption.objects.get_value(
            organization=organization, key="github:webhook_secret"
        )

    def post(self, request: Request, organization_id):
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.info(
                "github.webhook.invalid-organization", extra={"organization_id": organization_id}
            )
            return HttpResponse(status=400)

        return self.handle(request, organization=organization)
