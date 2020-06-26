from __future__ import absolute_import

from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.web.api import allow_cors_options

from sentry.models import Integration
from sentry.web.helpers import render_to_response

import json


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
        user_id = body["user"]["id"]
        team_id = body["teamId"]
        integration = Integration.objects.get(external_id=user_id or team_id, provider="vercel")
        if integration:
            organization_slugs = [org.slug for org in integration.organizations.all()]

            if request.method == "POST":
                return render_to_response(
                    "sentry/vercel-ui-hook.html",
                    request=request,
                    context={"org": organization_slugs[0], "integration_id": integration.id},
                )

        return HttpResponse("The requested integration does not exist.")
