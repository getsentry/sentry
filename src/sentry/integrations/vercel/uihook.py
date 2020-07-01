from __future__ import absolute_import

import json
import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.constants import ObjectStatus
from sentry.models import Integration, Organization, OrganizationIntegration
from sentry.web.api import allow_cors_options
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.integrations.vercel")


class VercelUIHook(Endpoint):
    auth_required = False

    @csrf_exempt
    @allow_cors_options
    def dispatch(self, request):
        if request.method == "OPTIONS":
            return HttpResponse(status=200)
        if request.method != "POST":
            return HttpResponse(status=405)
        body_unicode = request.body.decode("utf-8")
        body = json.loads(body_unicode)
        configuration_id = body["configurationId"]
        user_id = body["user"]["id"]
        team_id = body["teamId"]
        try:
            integration = Integration.objects.get(
                external_id=team_id or user_id, provider="vercel", status=ObjectStatus.ACTIVE
            )
        except Integration.DoesNotExist:
            return HttpResponse("The requested integration does not exist.")
        try:
            organization = Organization.objects.get(
                id=integration.metadata["configurations"][configuration_id]["organization_id"]
            )
        except KeyError:
            return HttpResponse("The requested integration does not exist.")
        try:
            OrganizationIntegration.objects.get(
                organization=organization.id, integration=integration.id
            )
        except OrganizationIntegration.DoesNotExist:
            logger.info(
                "vercel.organization-integration.does-not-exist",
                extra={"organization_id": organization.id, "integration_id": integration.id},
            )
            return HttpResponse("The requested integration does not exist.")
        return render_to_response(
            "sentry/vercel-ui-hook.vercel",
            request=request,
            context={"org": organization.slug, "integration_id": integration.id},
        )
