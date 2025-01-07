from __future__ import annotations

import logging
from abc import ABC
from collections.abc import Mapping
from datetime import timezone
from typing import Any

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import Http404, HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:gitlab"
GITHUB_WEBHOOK_SECRET_INVALID_ERROR = """Gitlab's webhook secret does not match. Refresh token (or re-install the integration) by following this https://docs.sentry.io/organization/integrations/integration-platform/public-integration/#refreshing-tokens."""


def get_gitlab_external_id(request, extra) -> tuple[str, str] | HttpResponse:
    token = "<unknown>"
    try:
        # Munge the token to extract the integration external_id.
        # gitlab hook payloads don't give us enough unique context
        # to find data on our side so we embed one in the token.
        token = request.META["HTTP_X_GITLAB_TOKEN"]
        # e.g. "example.gitlab.com:group-x:webhook_secret_from_sentry_integration_table"
        instance, group_path, secret = token.split(":")
        external_id = f"{instance}:{group_path}"
        return (external_id, secret)
    except KeyError:
        logger.info("gitlab.webhook.missing-gitlab-token")
        extra["reason"] = "The customer needs to set a Secret Token in their webhook."
        logger.exception(extra["reason"])
        return HttpResponse(status=400, reason=extra["reason"])
    except ValueError:
        logger.info("gitlab.webhook.malformed-gitlab-token", extra=extra)
        extra["reason"] = "The customer's Secret Token is malformed."
        logger.exception(extra["reason"])
        return HttpResponse(status=400, reason=extra["reason"])
    except Exception:
        logger.info("gitlab.webhook.invalid-token", extra=extra)
        extra["reason"] = "Generic catch-all error."
        logger.exception(extra["reason"])
        return HttpResponse(status=400, reason=extra["reason"])


class GitlabWebhook(SCMWebhook, ABC):
    @property
    def provider(self) -> str:
        return "gitlab"

    def get_repo(
        self, integration: RpcIntegration, organization: RpcOrganization, event: Mapping[str, Any]
    ):
        """
        Given a webhook payload, get the associated Repository record.

        Assumes a 'project' key in event payload.
        """
        try:
            project_id = event["project"]["id"]
        except KeyError:
            logger.info(
                "gitlab.webhook.missing-projectid", extra={"integration_id": integration.id}
            )
            logger.exception("Missing project ID.")
            raise Http404()

        external_id = "{}:{}".format(integration.metadata["instance"], project_id)
        try:
            repo = Repository.objects.get(
                organization_id=organization.id, provider=PROVIDER_NAME, external_id=external_id
            )
        except Repository.DoesNotExist:
            return None
        return repo

    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]):
        """
        Given a webhook payload, update stored repo data if needed.

        Assumes a 'project' key in event payload, with certain subkeys. Rework
        this if that stops being a safe assumption.
        """

        project = event["project"]

        url_from_event = project["web_url"]
        path_from_event = project["path_with_namespace"]

        if repo.url != url_from_event or repo.config.get("path") != path_from_event:
            repo.update(
                url=url_from_event,
                config=dict(repo.config, path=path_from_event),
            )


class MergeEventWebhook(GitlabWebhook):
    """
    Handle Merge Request Hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
    """

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PULL_REQUEST

    def __call__(self, event: Mapping[str, Any], **kwargs):
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        try:
            number = event["object_attributes"]["iid"]
            title = event["object_attributes"]["title"]
            body = event["object_attributes"]["description"]
            created_at = event["object_attributes"]["created_at"]
            merge_commit_sha = event["object_attributes"]["merge_commit_sha"]

            last_commit = event["object_attributes"]["last_commit"]
            author_email = None
            author_name = None
            if last_commit:
                author_email = last_commit["author"]["email"]
                author_name = last_commit["author"]["name"]
        except KeyError as e:
            logger.info(
                "gitlab.webhook.invalid-merge-data",
                extra={"integration_id": integration.id, "error": str(e)},
            )
            logger.exception("Invalid merge data.")
            # TODO(mgaeta): This try/catch is full of reportUnboundVariable errors.
            return

        if not author_email:
            raise Http404()

        author = CommitAuthor.objects.get_or_create(
            organization_id=organization.id, email=author_email, defaults={"name": author_name}
        )[0]

        author.preload_users()
        try:
            PullRequest.objects.update_or_create(
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                defaults={
                    "title": title,
                    "author": author,
                    "message": body,
                    "merge_commit_sha": merge_commit_sha,
                    "date_added": parse_date(created_at).astimezone(timezone.utc),
                },
            )
        except IntegrityError:
            pass


class PushEventWebhook(GitlabWebhook):
    """
    Handle push hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#push-events
    """

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PUSH

    def __call__(self, event: Mapping[str, Any], **kwargs):
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        authors = {}

        # TODO: gitlab only sends a max of 20 commits. If a push contains
        # more commits they provide a total count and require additional API
        # requests to fetch the commit details
        for commit in event.get("commits", []):
            if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                continue

            author_email = commit["author"]["email"]

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if author_email is None or len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": commit["author"]["name"]},
                )[0]
            else:
                author = authors[author_email]
            try:
                if author is not None:
                    author.preload_users()
                with transaction.atomic(router.db_for_write(Commit)):
                    Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )
            except IntegrityError:
                pass


@region_silo_endpoint
class GitlabWebhookEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = "gitlab"

    _handlers: dict[str, type[GitlabWebhook]] = {
        "Push Hook": PushEventWebhook,
        "Merge Request Hook": MergeEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405, reason="HTTP method not supported.")

        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        result = get_gitlab_external_id(request=request, extra=extra)
        if isinstance(result, HttpResponse):
            return result
        (external_id, secret) = result

        org_contexts = integration_service.organization_contexts(
            provider=self.provider, external_id=external_id
        )
        integration = org_contexts.integration
        installs = org_contexts.organization_integrations
        if integration is None:
            logger.info("gitlab.webhook.invalid-organization", extra=extra)
            extra["reason"] = "There is no integration that matches your organization."
            logger.error(extra["reason"])
            return HttpResponse(status=409, reason=extra["reason"])

        extra = {
            **extra,
            **{
                "integration": {
                    # The metadata could be useful to debug
                    # domain_name -> gitlab.com/getsentry-ecosystem/foo'
                    # scopes -> ['api']
                    "metadata": integration.metadata,
                    "id": integration.id,  # This is useful to query via Redash
                    "status": integration.status,  # 0 seems to be active
                },
                "org_ids": [install.organization_id for install in installs],
            },
        }

        if not constant_time_compare(secret, integration.metadata["webhook_secret"]):
            # Summary and potential workaround mentioned here:
            # https://github.com/getsentry/sentry/issues/34903#issuecomment-1262754478
            extra["reason"] = GITHUB_WEBHOOK_SECRET_INVALID_ERROR
            logger.info("gitlab.webhook.invalid-token-secret", extra=extra)
            return HttpResponse(status=409, reason=GITHUB_WEBHOOK_SECRET_INVALID_ERROR)

        try:
            event = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            logger.info("gitlab.webhook.invalid-json", extra=extra)
            extra["reason"] = "Data received is not JSON."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        try:
            handler = self._handlers[request.META["HTTP_X_GITLAB_EVENT"]]
        except KeyError:
            logger.info("gitlab.webhook.wrong-event-type", extra=extra)
            supported_events = ", ".join(sorted(self._handlers.keys()))
            logger.info("We only support these kinds of events: %s", supported_events)
            extra["reason"] = (
                "The customer has edited the webhook in Gitlab to include other types of events."
            )
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

        for install in installs:
            org_context = organization_service.get_organization_by_id(
                id=install.organization_id, include_teams=False, include_projects=False
            )
            if org_context:
                organization = org_context.organization
                event_handler = handler()

                with IntegrationWebhookEvent(
                    interaction_type=event_handler.event_type,
                    domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
                    provider_key=event_handler.provider,
                ).capture():
                    event_handler(event, integration=integration, organization=organization)

        return HttpResponse(status=204)
