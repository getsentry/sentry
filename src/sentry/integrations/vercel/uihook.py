from __future__ import absolute_import

import json

from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.constants import ObjectStatus
from sentry.models import Integration, Organization, OrganizationIntegration
from sentry.web.api import allow_cors_options
from sentry.web.helpers import render_to_response


class VercelUIHook(Endpoint):
    auth_required = False

    @csrf_exempt
    @allow_cors_options
    def dispatch(self, request):
        if request.method == "OPTIONS":
            return HttpResponse(status=200)
        if request.method != "POST":
            return HttpResponseNotFound("Page not found")
        body_unicode = request.body.decode("utf-8")
        body = json.loads(body_unicode)
        configuration_id = body["configurationId"]
        user_id = body["user"]["id"]
        team_id = body["teamId"]
        integration = Integration.objects.get(external_id=team_id or user_id, provider="vercel")
        if integration and integration.status == ObjectStatus.ACTIVE:
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
                return HttpResponse("The requested integration does not exist.")
            if request.method == "POST":
                return render_to_response(
                    "sentry/vercel-ui-hook.vercel",
                    request=request,
                    context={"org": organization.slug, "integration_id": integration.id},
                )
        return HttpResponse("The requested integration does not exist.")
