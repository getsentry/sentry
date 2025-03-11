from __future__ import annotations

import logging
import time

import orjson
from django.http import HttpResponse
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration

logger = logging.getLogger("sentry.webhooks")

INSTALLATION_EXPOSURE_MAX_TIME = 10 * 60


@control_silo_endpoint
class GitHubIntegrationsInstallationEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    permission_classes = (SentryIsAuthenticated,)

    def get(self, request: Request, installation_id):
        try:
            integration = Integration.objects.get(
                external_id=installation_id, status=ObjectStatus.ACTIVE
            )
            OrganizationIntegration.objects.get(integration_id=integration.id)
            return HttpResponse(status=404)
        except Integration.DoesNotExist:
            return HttpResponse(status=404)
        except OrganizationIntegration.DoesNotExist:
            pass

        if "sender" not in integration.metadata:
            return HttpResponse(status=404)

        assert integration.date_added is not None
        time_elapsed_since_added = time.time() - integration.date_added.timestamp()
        if time_elapsed_since_added > INSTALLATION_EXPOSURE_MAX_TIME:
            return HttpResponse(status=404)

        result = {
            "account": {
                "login": integration.name,
                "type": integration.metadata["account_type"],
            },
            "sender": integration.metadata["sender"],
        }

        return HttpResponse(orjson.dumps(result), status=200, content_type="application/json")
