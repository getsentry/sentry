from __future__ import absolute_import

import hashlib
import hmac
import logging
import six

from django.views.decorators.csrf import csrf_exempt
from django.utils.crypto import constant_time_compare
from requests.exceptions import RequestException
from sentry import http, options, VERSION
from sentry.api.base import Endpoint
from sentry.models import (
    OrganizationIntegration,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
    Project,
)
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.utils.compat import filter
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


class NoCommitFoundError(IntegrationError):
    pass


def verify_signature(request):
    signature = request.META["HTTP_X_ZEIT_SIGNATURE"]
    secret = options.get("vercel.client-secret")

    expected = hmac.new(
        key=secret.encode("utf-8"), msg=six.binary_type(request.body), digestmod=hashlib.sha1
    ).hexdigest()
    return constant_time_compare(expected, signature)


class VercelWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    provider = "vercel"

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(VercelWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    # given the webhook payload and sentry_project_id, return
    # the payload we use for generating the release with the token
    def get_payload_and_token(self, payload, organization_id, sentry_project_id):
        meta = payload["deployment"]["meta"]

        # look up the project so we can get the slug
        project = Project.objects.get(id=sentry_project_id)

        # find the connected sentry app installation
        installation_for_provider = SentryAppInstallationForProvider.objects.select_related(
            "sentry_app_installation"
        ).get(organization_id=organization_id, provider=self.provider)
        sentry_app_installation = installation_for_provider.sentry_app_installation

        # find a token associated with the installation so we can use it for authentication
        sentry_app_installation_token = (
            SentryAppInstallationToken.objects.select_related("api_token")
            .filter(sentry_app_installation=sentry_app_installation)
            .first()
        )
        if not sentry_app_installation_token:
            raise SentryAppInstallationToken.DoesNotExist()

        # find the commmit sha so we can  use it as as the release
        commit_sha = (
            meta.get("githubCommitSha")
            or meta.get("gitlabCommitSha")
            or meta.get("bitbucketCommitSha")
        )

        # contruct the repo depeding what provider we use
        if meta.get("githubCommitSha"):
            # we use these instead of githubOrg and githubRepo since it's the repo the user has access to
            repository = u"%s/%s" % (meta["githubCommitOrg"], meta["githubCommitRepo"])
        elif meta.get("gitlabCommitSha"):
            # gitlab repos are formatted with a space for some reason
            repository = u"%s / %s" % (meta["gitlabProjectNamespace"], meta["gitlabProjectName"],)
        elif meta.get("bitbucketCommitSha"):
            repository = u"%s/%s" % (meta["bitbucketRepoOwner"], meta["bitbucketRepoName"])
        else:
            # this can happen with manual builds
            raise NoCommitFoundError("No commit found")

        release_payload = {
            "version": commit_sha,
            "projects": [project.slug],
            "refs": [{"repository": repository, "commit": commit_sha}],
        }
        return [release_payload, sentry_app_installation_token.api_token.token]

    @transaction_start("VercelWebhookEndpoint")
    def post(self, request):
        if not request.META.get("HTTP_X_ZEIT_SIGNATURE"):
            logger.error("vercel.webhook.missing-signature")
            self.respond(status=401)

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
                    [release_payload, token] = self.get_payload_and_token(
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
                    "Authorization": u"Bearer %s" % token,
                    "User-Agent": u"sentry_vercel/{}".format(VERSION),
                }
                json_error = None

                # create the basic release payload without refs
                no_ref_payload = release_payload.copy()
                del no_ref_payload["refs"]
                try:
                    resp = session.post(url, json=no_ref_payload, headers=headers)
                    json_error = resp.json()
                    resp.raise_for_status()
                except RequestException as e:
                    # errors here should be uncommon but we should be aware of them
                    logger.error(
                        "Error creating release: %s - %s" % (e, json_error),
                        extra=logging_params,
                        exc_info=True,
                    )
                    # 400 probably isn't the right status code but oh well
                    return self.respond({"detail": "Error creating release: %s" % e}, status=400)

                # set the refs
                try:
                    resp = session.post(url, json=release_payload, headers=headers,)
                    json_error = resp.json()
                    resp.raise_for_status()
                except RequestException as e:
                    # errors will probably be common if the user doesn't have repos set up
                    logger.info(
                        "Error setting refs: %s - %s" % (e, json_error),
                        extra=logging_params,
                        exc_info=True,
                    )
                    # 400 probably isn't the right status code but oh well
                    return self.respond({"detail": "Error setting refs: %s" % e}, status=400)

                # we are going to quit after the first project match as there shouldn't be multiple matches
                return self.respond(status=201)
        return self.respond(status=204)
