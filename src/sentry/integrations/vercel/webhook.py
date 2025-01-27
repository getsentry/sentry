from __future__ import annotations

import hashlib
import hmac
import logging
from collections.abc import Mapping
from typing import Any, TypedDict

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.crypto import constant_time_compare
from django.views.decorators.csrf import csrf_exempt
from requests.exceptions import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import VERSION, audit_log, http, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.project import Project
from sentry.projects.services.project import project_service
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.audit import create_audit_entry
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.vercel.webhook")


class NoCommitFoundError(IntegrationError):
    pass


class MissingRepositoryError(IntegrationError):
    pass


class _ReleasePayload(TypedDict):
    version: str
    projects: list[str]
    refs: list[dict[str, str]]


def verify_signature(request):
    signature = request.META.get("HTTP_X_VERCEL_SIGNATURE")
    secret = options.get("vercel.client-secret")

    expected = hmac.new(
        key=secret.encode("utf-8"), msg=bytes(request.body), digestmod=hashlib.sha1
    ).hexdigest()

    return constant_time_compare(expected, signature)


def safe_json_parse(resp):
    if resp.headers.get("content-type") == "application/json":
        return resp.json()
    return None


def get_commit_sha(meta: Mapping[str, str]) -> str:
    """Find the commit SHA so we can use it as as the release."""
    commit_sha = (
        meta.get("githubCommitSha") or meta.get("gitlabCommitSha") or meta.get("bitbucketCommitSha")
    )

    if not commit_sha:
        # This can happen with manual builds.
        raise NoCommitFoundError("No commit found")

    return commit_sha


def get_repository(meta: Mapping[str, str]) -> str:
    """Construct the repository string depending what provider we use."""

    try:
        if meta.get("githubCommitSha"):
            # We use these instead of githubOrg and githubRepo since it's the repo the user has access to.
            return f'{meta["githubCommitOrg"]}/{meta["githubCommitRepo"]}'

        if meta.get("gitlabCommitSha"):
            # GitLab repos are formatted with a space for some reason.
            return f'{meta["gitlabProjectNamespace"]} / {meta["gitlabProjectName"]}'

        if meta.get("bitbucketCommitSha"):
            return f'{meta["bitbucketRepoOwner"]}/{meta["bitbucketRepoName"]}'

    except KeyError:
        pass

    raise MissingRepositoryError("Could not determine repository")


def get_payload_and_token(
    payload: Mapping[str, Any], organization_id: int, sentry_project_id: int
) -> tuple[_ReleasePayload, str]:
    meta = payload["deployment"]["meta"]

    # look up the project so we can get the slug
    project = project_service.get_by_id(organization_id=organization_id, id=sentry_project_id)
    if project is None:
        raise Project.DoesNotExist

    # find the connected sentry app installation
    installation_for_provider = SentryAppInstallationForProvider.objects.select_related(
        "sentry_app_installation"
    ).get(organization_id=organization_id, provider="vercel")
    sentry_app_installation = installation_for_provider.sentry_app_installation

    # find a token associated with the installation so we can use it for authentication
    sentry_app_installation_token = (
        SentryAppInstallationToken.objects.select_related("api_token")
        .filter(sentry_app_installation=sentry_app_installation)
        .first()
    )
    if not sentry_app_installation_token:
        raise SentryAppInstallationToken.DoesNotExist()

    commit_sha = get_commit_sha(meta)
    repository = get_repository(meta)

    release_payload: _ReleasePayload = {
        "version": commit_sha,
        "projects": [project.slug],
        "refs": [{"repository": repository, "commit": commit_sha}],
    }
    return release_payload, sentry_app_installation_token.api_token.token


@control_silo_endpoint
class VercelWebhookEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = "vercel"

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return super().dispatch(request, *args, **kwargs)

    def parse_external_id(self, request: Request) -> str:
        payload = request.data["payload"]
        # New Vercel request flow
        external_id = (
            payload.get("team")["id"]
            if (payload.get("team") and payload.get("team") != {})
            else payload["user"]["id"]
        )
        return external_id

    def post(self, request: Request) -> Response | None:
        if not request.META.get("HTTP_X_VERCEL_SIGNATURE"):
            logger.error("vercel.webhook.missing-signature")
            return self.respond(status=401)
        is_valid = verify_signature(request)
        if not is_valid:
            logger.error("vercel.webhook.invalid-signature")
            return self.respond(status=401)

        # Vercel's webhook allows you to subscribe to different events,
        # denoted by the `type` attribute. We currently subscribe to:
        #     * integration-configuration.removed (Configuration Removed)
        #     * deployment.created (Deployment Created)
        # https://vercel.com/docs/integrations/webhooks-overview
        try:
            event_type = request.data["type"]
        except KeyError:
            return self.respond({"detail": "Missing event type."}, status=400)

        external_id = self.parse_external_id(request)
        if event_type == "integration-configuration.removed":
            configuration_id = request.data["payload"]["configuration"]["id"]
            return self._delete(external_id, configuration_id, request)
        if event_type == "deployment.created":
            return self._deployment_created(external_id, request)
        return None

    def delete(self, request: Request):
        external_id = self.parse_external_id(request)
        configuration_id = request.data["payload"]["configuration"]["id"]

        return self._delete(external_id, configuration_id, request)

    def _delete(self, external_id, configuration_id, request):
        try:
            integration = Integration.objects.get(provider="vercel", external_id=external_id)
        except Integration.DoesNotExist:
            logger.info(
                "vercel.uninstall.missing-integration",
                extra={"configuration_id": configuration_id, "external_id": external_id},
            )
            return self.respond(status=404)

        org_ids = integration.organizationintegration_set.values_list("organization_id", flat=True)

        if len(org_ids) == 0:
            # we already deleted the organization integration and
            # there was only one to begin with

            integration.delete()
            return self.respond(status=204)

        # If we never set "configurations" in the integration, then we only have one
        # and therefore can delete it.
        if not integration.metadata.get("configurations"):
            integration.delete()
            return self.respond(status=204)

        configuration = integration.metadata["configurations"].pop(configuration_id)

        # one of two cases:
        #  1.) someone is deleting from vercel's end and we still need to delete the
        #      organization integration AND the integration (since there is only one)
        #  2.) we already deleted the organization integration tied to this configuration
        #      and the remaining one is for a different org (and configuration)

        if len(org_ids) == 1:
            try:
                # Case no. 1: do the deleting and return
                OrganizationIntegration.objects.get(
                    organization_id=configuration["organization_id"], integration_id=integration.id
                )
                create_audit_entry(
                    request=request,
                    organization_id=org_ids[0],
                    target_object=integration.id,
                    event=audit_log.get_event_id("INTEGRATION_REMOVE"),
                    actor_label="Vercel User",
                    data={"provider": integration.provider, "name": integration.name},
                )
                integration.delete()
                return self.respond(status=204)
            except OrganizationIntegration.DoesNotExist:
                # Case no. 2: continue onto updating integration.metadata
                logger.info(
                    "vercel.uninstall.org-integration-already-deleted",
                    extra={
                        "configuration_id": configuration_id,
                        "external_id": external_id,
                        "integration_id": integration.id,
                        "organization_id": configuration["organization_id"],
                    },
                )

        if configuration_id == integration.metadata["installation_id"]:
            # if we are uninstalling a primary configuration, and there are
            # multiple orgs connected to this integration we must update
            # the credentials (access_token, webhook_id etc).
            next_config_id, next_config = list(integration.metadata["configurations"].items())[0]

            integration.metadata["access_token"] = next_config["access_token"]
            integration.metadata["webhook_id"] = next_config["webhook_id"]
            integration.metadata["installation_id"] = next_config_id

        integration.save()

        # At this point we can consider if len(orgs) > 1. We have already updated the
        # integration.metadata, but we may not have deleted the OrganizationIntegration
        try:
            OrganizationIntegration.objects.get(
                organization_id=configuration["organization_id"], integration_id=integration.id
            ).delete()

            create_audit_entry(
                request=request,
                organization_id=configuration["organization_id"],
                target_object=integration.id,
                event=audit_log.get_event_id("INTEGRATION_REMOVE"),
                actor_label="Vercel User",
                data={"provider": integration.provider, "name": integration.name},
            )
        except OrganizationIntegration.DoesNotExist:
            logger.info(
                "vercel.uninstall.org-integration-already-deleted",
                extra={
                    "configuration_id": configuration_id,
                    "external_id": external_id,
                    "integration_id": integration.id,
                    "organization_id": configuration["organization_id"],
                },
            )

        return self.respond(status=204)

    def _deployment_created(self, external_id, request):
        payload = request.data["payload"]
        vercel_project_id = (
            payload["projectId"] if payload.get("projectId") else payload["project"]["id"]
        )
        # Only create releases for production deploys for now
        if payload["target"] != "production":
            logger.info(
                "Ignoring deployment for environment: %s",
                payload["target"],
                extra={"external_id": external_id, "vercel_project_id": vercel_project_id},
            )
            return self.respond(status=204)
        """
        Steps:
            1. Find all org integrations that match the external id
            2. Search the configs to find one that matches the vercel project of the webhook
            3. Look up the Sentry project that matches
            4. Look up the connected internal integration
            5. Find the token associated with that installation
            6. Determine the commit sha and repo based on what provider is used
            7. Create the release using the token WITHOUT refs
            8. Update the release with refs
        """

        logging_params = {"external_id": external_id, "vercel_project_id": vercel_project_id}

        org_integrations = list(
            OrganizationIntegration.objects.filter(
                integration__external_id=external_id, integration__provider=self.provider
            )
        )
        if not org_integrations:
            logger.info("Integration not found", extra=logging_params)
            return self.respond({"detail": "Integration not found"}, status=404)

        orgs = {
            o.id: o
            for o in organization_mapping_service.get_many(
                organization_ids=[oi.organization_id for oi in org_integrations]
            )
        }
        # for each org integration, search the configs to find one that matches the vercel project of the webhook
        for org_integration in org_integrations:
            project_mappings = org_integration.config.get("project_mappings") or []
            matched_mappings = list(filter(lambda x: x[1] == vercel_project_id, project_mappings))
            if matched_mappings:
                organization = orgs.get(org_integration.organization_id)
                if organization is None:
                    continue
                sentry_project_id = matched_mappings[0][0]

                logging_params["organization_id"] = organization.id
                logging_params["project_id"] = sentry_project_id

                try:
                    release_payload, token = get_payload_and_token(
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
                except MissingRepositoryError:
                    logger.info("Could not determine repository", extra=logging_params)
                    return self.respond({"detail": "Could not determine repository"}, status=400)

                url = absolute_uri(f"/api/0/organizations/{organization.slug}/releases/")
                headers = {
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}",
                    "User-Agent": f"sentry_vercel/{VERSION}",
                }
                json_error = None

                no_ref_payload = {
                    "version": release_payload["version"],
                    "projects": release_payload["projects"],
                }

                with http.build_session() as session:
                    try:
                        resp = session.post(url, json=no_ref_payload, headers=headers)
                        json_error = safe_json_parse(resp)
                        resp.raise_for_status()
                    except RequestException as e:
                        # errors here should be uncommon but we should be aware of them
                        logger.exception(
                            "Error creating release: %s - %s",
                            e,
                            json_error,
                            extra=logging_params,
                        )
                        # 400 probably isn't the right status code but oh well
                        return self.respond({"detail": f"Error creating release: {e}"}, status=400)

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
                            "Error setting refs: %s - %s",
                            e,
                            json_error,
                            extra=logging_params,
                            exc_info=True,
                        )
                        # 400 probably isn't the right status code but oh well
                        return self.respond({"detail": f"Error setting refs: {e}"}, status=400)

                # we are going to quit after the first project match as there shouldn't be multiple matches
                return self.respond(status=201)

        return self.respond(status=204)
