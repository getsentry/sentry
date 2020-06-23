from __future__ import absolute_import

import six
import hmac
import hashlib
import logging

from django.core.urlresolvers import reverse
from django.views.decorators.csrf import csrf_exempt
from django.utils.crypto import constant_time_compare
from sentry import options
from sentry.api.base import Endpoint
from sentry.web.decorators import transaction_start
from sentry.models import Integration, OrganizationIntegration, SentryAppInstallationForProvider, SentryAppInstallationToken, Project, Release, ApiKey, SentryApp
from sentry.api import client
from sentry import http
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


def verify_signature(request):
    signature = request.META["HTTP_X_ZEIT_SIGNATURE"]
    secret = options.get("vercel.client-secret")

    expected = hmac.new(
        key=secret.encode("utf-8"), msg=six.binary_type(request.data), digestmod=hashlib.sha1
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
            # return self.respond(status=401)

        data = request.data
        external_id = data.get("teamId") or data["userId"]

        payload = data["payload"]
        meta = payload["deployment"]["meta"]
        vercel_project_id = payload["projectId"]

        print("meta", meta)

        # TODO: run try/catch
        try:
            org_integrations = OrganizationIntegration.objects.select_related("organization").filter(integration__external_id=external_id, integration__provider=self.provider)
        except OrganizationIntegration.DoesNotExist:
            return self.respond({"detail": "Integration not found"}, status=404)

        for org_integration in org_integrations:
            project_mappings = org_integration.config.get('project_mappings') or []
            matched_mappings = filter(lambda x: x[1] == vercel_project_id, project_mappings)
            if matched_mappings:
                organization = org_integration.organization
                sentry_project_id = matched_mappings[0][0]

                try:
                    project = Project.objects.get(id=sentry_project_id)
                except Project.DoesNotExist:
                    return self.respond({"detail": "Project not found"}, status=404)

                try:
                    installation_for_provider = SentryAppInstallationForProvider.objects.select_related("sentry_app_installation").get(organization_id=organization.id, provider=self.provider)
                    sentry_app_installation = installation_for_provider.sentry_app_installation
                except SentryAppInstallationForProvider.DoesNotExist:
                    return self.respond({"detail": "Installation not found"}, status=404)

                try:
                    sentry_app_installation_token = SentryAppInstallationToken.objects.select_related("api_token").filter(
                        sentry_app_installation=sentry_app_installation
                    ).first()
                except SentryAppInstallationToken.DoesNotExist:
                    return self.respond({"detail": "Token not found"}, status=404)

                # TODO: add other proviers
                commit_sha = meta.get("githubCommitSha") or meta.get("gitlabCommitSha") or meta.get("bitbucketCommitSha")

                if meta.get("githubCommitSha"):
                    # There is also githubRepo and githubRepo
                    repository = u"%s/%s"%(meta["githubCommitOrg"], meta["githubCommitRepo"])
                elif meta.get("gitlabCommitSha"):
                    repository = meta["gitlabProjectPath"]
                elif meta.get("bitbucketCommitSha"):
                    repository = u"%s/%s"%(meta["bitbucketRepoOwner"], meta["bitbucketRepoName"])
                else:
                    return self.respond({"detail": "No commit sha"}, status=400)

                data = {
                    "version": commit_sha,
                    "projects": [project.slug],
                    "refs": [
                        {
                            "repository": repository,
                            "commit": commit_sha,
                        }
                    ]
                }

                session = http.build_session()
                resp = session.post(
                    absolute_uri("/api/0/organizations/%s/releases/" % organization.slug),
                    json=data,
                    headers={"Accept": "application/json", "Authorization": "Bearer %s" % sentry_app_installation_token.api_token.token},
                )
                # do we need to raise for status?
                resp.raise_for_status()

        # TODO: Should we return other status codes if something fails?
        return self.respond(201)
