from __future__ import absolute_import

import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import urlencode


from sentry.api.base import Endpoint, allow_cors_options
from sentry.constants import ObjectStatus
from sentry.models import Integration, Organization, OrganizationIntegration, OrganizationStatus
from sentry.utils import json
from sentry.utils.http import absolute_uri
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
        external_id = team_id or user_id
        try:
            integration = Integration.objects.get(
                external_id=external_id, provider="vercel", status=ObjectStatus.ACTIVE
            )
        except Integration.DoesNotExist:
            logger.info(
                "vercel.integration.does-not-exist", extra={"external_id": external_id},
            )
            return HttpResponse("The requested integration does not exist.")
        try:
            organization = Organization.objects.get(
                id=integration.metadata["configurations"][configuration_id]["organization_id"],
                status=OrganizationStatus.ACTIVE,
            )
        except KeyError:
            logger.info(
                "vercel.integration.key-error",
                extra={"external_id": external_id, "integration_id": integration.id},
            )
            return HttpResponse("Cannot fetch organization.")
        except Organization.DoesNotExist:
            logger.info(
                "vercel.organization.does-not-exist",
                extra={"external_id": external_id, "integration_id": integration.id},
            )
            return HttpResponse("Organization does not exist")
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

        connect_projects_link = absolute_uri(
            u"/settings/%s/integrations/vercel/%s/" % (organization.slug, integration.id)
        )
        doc_link = "https://docs.sentry.io/workflow/integrations/global-integrations/#vercel"
        source_code_link = absolute_uri(
            u"/settings/%s/integrations/?%s"
            % (organization.slug, urlencode({"category": "source code management"}))
        )
        return render_to_response(
            "sentry/vercel-ui-hook.vercel",
            request=request,
            context={
                "org": organization.name,
                "connect_projects_link": connect_projects_link,
                "source_code_link": source_code_link,
                "doc_link": doc_link,
            },
        )
