from __future__ import absolute_import

import hashlib
import hmac
import logging
import six

from django.views.decorators.csrf import csrf_exempt
from django.utils.crypto import constant_time_compare
from requests.exceptions import ConnectionError, HTTPError, Timeout
from sentry import http, options
from sentry.api.base import Endpoint
from sentry.models import (
    OrganizationIntegration,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
    Project,
)
from sentry.utils.http import absolute_uri
from sentry.utils.compat import filter
from sentry.web.decorators import transaction_start

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


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
        meta = payload["deployment"]["meta"]

        external_id = data.get("teamId") or data["userId"]
        vercel_project_id = payload["projectId"]

        logging_params = {"external_id": external_id, "vercel_project_id": vercel_project_id}

        # Steps:
        # 1. find all og integrtions that match the external id
        # 2. search the configs to find one that matches the vercel project of the webhook
        # 3. Look up the Sentry project that matches
        # 4. Look up the connected internal integration
        # 5. find the token associated with that installation
        # 6. Determine the commit sha and repo based on what provider is used
        # 7. Hit the releases endpoint using the token we found earlier

        # find all og integrtions that match the external id
        try:
            org_integrations = OrganizationIntegration.objects.select_related(
                "organization"
            ).filter(integration__external_id=external_id, integration__provider=self.provider)
        except OrganizationIntegration.DoesNotExist:
            logger.info("Integration not found", extra=logging_params)
            return self.respond({"detail": "Integration not found"}, status=404)

        # for each org integration, search the configs to find one that matches the vercel project of the webhook
        for org_integration in org_integrations:
            project_mappings = org_integration.config.get("project_mappings") or []
            matched_mappings = filter(lambda x: x[1] == vercel_project_id, project_mappings)
            if matched_mappings:
                organization = org_integration.organization
                sentry_project_id = matched_mappings[0][0]

                logging_params["sentry_project_id"] = sentry_project_id

                # look up the project so we can get the slug
                try:
                    project = Project.objects.get(id=sentry_project_id)
                except Project.DoesNotExist:
                    logger.info("Project not found", extra=logging_params)
                    return self.respond({"detail": "Project not found"}, status=404)

                logging_params["organization_id"] = organization.id

                # find the connected sentry app installation
                try:
                    installation_for_provider = SentryAppInstallationForProvider.objects.select_related(
                        "sentry_app_installation"
                    ).get(
                        organization_id=organization.id, provider=self.provider
                    )
                    sentry_app_installation = installation_for_provider.sentry_app_installation
                except SentryAppInstallationForProvider.DoesNotExist:
                    logger.info("Installation not found", extra=logging_params)
                    return self.respond({"detail": "Installation not found"}, status=404)

                logging_params["sentry_app_installation_id"] = sentry_app_installation.id

                # find a token associated with the installation so we can use it for authentication
                try:
                    sentry_app_installation_token = (
                        SentryAppInstallationToken.objects.select_related("api_token")
                        .filter(sentry_app_installation=sentry_app_installation)
                        .first()
                    )
                except SentryAppInstallationToken.DoesNotExist:
                    logger.info("Token not found", extra=logging_params)
                    return self.respond({"detail": "Token not found"}, status=404)

                # find the commmit sha so we can  use it as as the release
                commit_sha = (
                    meta.get("githubCommitSha")
                    or meta.get("gitlabCommitSha")
                    or meta.get("bitbucketCommitSha")
                )

                # contruct the repo depeding what provider we use
                if meta.get("githubCommitSha"):
                    # There is also githubRepo and githubRepo
                    repository = u"%s/%s" % (meta["githubCommitOrg"], meta["githubCommitRepo"])
                elif meta.get("gitlabCommitSha"):
                    # gitlab repos are formatted with a space for some reason
                    repository = u"%s / %s" % (
                        meta["gitlabProjectNamespace"],
                        meta["gitlabProjectName"],
                    )
                elif meta.get("bitbucketCommitSha"):
                    repository = u"%s/%s" % (meta["bitbucketRepoOwner"], meta["bitbucketRepoName"])
                else:
                    logger.info("No commit sha", extra=logging_params)
                    return self.respond({"detail": "No commit sha"}, status=400)

                data = {
                    "version": commit_sha,
                    "projects": [project.slug],
                    "refs": [{"repository": repository, "commit": commit_sha}],
                }
                logging_params["repository"] = repository
                logging_params["commit_sha"] = commit_sha

                # hit the org releases endpoint using the authentication for the internal integration
                try:
                    session = http.build_session()
                    resp = session.post(
                        absolute_uri("/api/0/organizations/%s/releases/" % organization.slug),
                        json=data,
                        headers={
                            "Accept": "application/json",
                            "Authorization": "Bearer %s"
                            % sentry_app_installation_token.api_token.token,
                        },
                    )
                    resp.raise_for_status()
                except (ConnectionError, Timeout, HTTPError) as e:
                    # errors here should be uncommon but we should be aware of them
                    logger.error(
                        "Error creating release: %s" % e, extra=logging_params, exc_info=True
                    )
                    # 400 probably isn't the right status code but oh well
                    return self.respond({"detail": "Error creating release: %s" % e}, status=400)

                # we are going to quit after the first project match as there shouldn't be multiple matches
                return self.respond(201)
        return self.respond(202)
