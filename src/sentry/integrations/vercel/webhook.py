import logging

from django.views.decorators.csrf import csrf_exempt
from requests.exceptions import RequestException

from sentry import VERSION, http
from sentry.api.base import Endpoint
from sentry.models import (
    OrganizationIntegration,
    Project,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
)
from sentry.utils.compat import filter
from sentry.utils.http import absolute_uri

from .uninstall import NoCommitFoundError, get_payload_and_token, safe_json_parse, verify_signature

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


class VercelWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    provider = "vercel"

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request):
        if not request.META.get("HTTP_X_ZEIT_SIGNATURE"):
            logger.error("vercel.webhook.missing-signature")
            return self.respond(status=401)

        is_valid = verify_signature(request)

        if not is_valid:
            logger.error("vercel.webhook.invalid-signature")
            return self.respond(status=401)

        data = request.data
        payload = data["payload"]
        external_id = data.get("teamId") or data["userId"]
        vercel_project_id = payload["projectId"]

        logging_params = {"external_id": external_id, "vercel_project_id": vercel_project_id}

        if payload["target"] != "production":
            logger.info(
                "Ignoring deployment for environment: %s" % payload["target"], extra=logging_params
            )
            return self.respond(status=204)

        # Steps:
        # 1. Find all org integrations that match the external id
        # 2. Search the configs to find one that matches the vercel project of the webhook
        # 3. Look up the Sentry project that matches
        # 4. Look up the connected internal integration
        # 5. Find the token associated with that installation
        # 6. Determine the commit sha and repo based on what provider is used
        # 7. Create the release using the token WITHOUT refs
        # 8. Update the release with refs

        # find all org integrations that match the external id
        org_integrations = OrganizationIntegration.objects.select_related("organization").filter(
            integration__external_id=external_id, integration__provider=self.provider
        )
        if not org_integrations:
            logger.info("Integration not found", extra=logging_params)
            return self.respond({"detail": "Integration not found"}, status=404)

        # for each org integration, search the configs to find one that matches the vercel project of the webhook
        for org_integration in org_integrations:
            project_mappings = org_integration.config.get("project_mappings") or []
            matched_mappings = filter(lambda x: x[1] == vercel_project_id, project_mappings)
            if matched_mappings:
                organization = org_integration.organization
                sentry_project_id = matched_mappings[0][0]

                logging_params["organization_id"] = organization.id
                logging_params["project_id"] = sentry_project_id

                try:
                    [release_payload, token] = get_payload_and_token(
                        payload, organization.id, sentry_project_id
                    )
                except Project.DoesNotExist:
                    logger.info("Project not found", extra=logging_params)
                    return self.respond({"detail": "Project not found"}, status=404)
                except SentryAppInstallationForProvider.DoesNotExist:
                    logger.info("Installation not found", extra=logging_params)
                    return self.respond({"detail": "Installation not found"}, status=404)
                except SentryAppInstallationToken.DoesNotExist:
                    logger.info("Token not found", extra=logging_params)
                    return self.respond({"detail": "Token not found"}, status=404)
                except NoCommitFoundError:
                    logger.info("No commit found", extra=logging_params)
                    return self.respond({"detail": "No commit found"}, status=404)

                session = http.build_session()
                url = absolute_uri("/api/0/organizations/%s/releases/" % organization.slug)
                headers = {
                    "Accept": "application/json",
                    "Authorization": "Bearer %s" % token,
                    "User-Agent": f"sentry_vercel/{VERSION}",
                }
                json_error = None

                # create the basic release payload without refs
                no_ref_payload = release_payload.copy()
                del no_ref_payload["refs"]
                try:
                    resp = session.post(url, json=no_ref_payload, headers=headers)
                    json_error = safe_json_parse(resp)
                    resp.raise_for_status()
                except RequestException as e:
                    # errors here should be uncommon but we should be aware of them
                    logger.error(
                        f"Error creating release: {e} - {json_error}",
                        extra=logging_params,
                        exc_info=True,
                    )
                    # 400 probably isn't the right status code but oh well
                    return self.respond({"detail": "Error creating release: %s" % e}, status=400)

                # set the refs
                try:
                    resp = session.post(
                        url,
                        json=release_payload,
                        headers=headers,
                    )
                    json_error = safe_json_parse(resp)
                    resp.raise_for_status()
                except RequestException as e:
                    # errors will probably be common if the user doesn't have repos set up
                    logger.info(
                        f"Error setting refs: {e} - {json_error}",
                        extra=logging_params,
                        exc_info=True,
                    )
                    # 400 probably isn't the right status code but oh well
                    return self.respond({"detail": "Error setting refs: %s" % e}, status=400)

                # we are going to quit after the first project match as there shouldn't be multiple matches
                return self.respond(status=201)
        return self.respond(status=204)
