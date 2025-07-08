import logging
from abc import ABC
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import orjson
import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.api.exceptions import BadRequest
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.shared_integrations.exceptions import ApiHostError, ApiUnauthorized, IntegrationError
from sentry.web.frontend.base import region_silo_view

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:bitbucket_server"


class BitbucketServerWebhook(SCMWebhook, ABC):
    @property
    def provider(self):
        return "bitbucket_server"

    def update_repo_data(self, repo, event):
        """
        Given a webhook payload, update stored repo data if needed.
        """

        name_from_event = event["repository"]["project"]["key"] + "/" + event["repository"]["slug"]
        if repo.name != name_from_event or repo.config.get("name") != name_from_event:
            repo.update(name=name_from_event, config=dict(repo.config, name=name_from_event))


class PushEventWebhook(BitbucketServerWebhook):
    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PUSH

    def __call__(self, event: Mapping[str, Any], **kwargs) -> None:
        authors = {}

        if not (
            (organization := kwargs.get("organization"))
            and (integration_id := kwargs.get("integration_id"))
        ):
            raise ValueError("Organization and integration_id must be provided")

        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=str(event["repository"]["id"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        provider = repo.get_provider()
        try:
            installation = provider.get_installation(integration_id, organization.id)
        except Integration.DoesNotExist:
            raise Http404()

        try:
            client = installation.get_client()
        except IntegrationError:
            raise BadRequest()

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        [project_name, repo_name] = repo.name.split("/")

        for change in event["changes"]:
            from_hash = None if change.get("fromHash") == "0" * 40 else change.get("fromHash")
            try:
                commits = client.get_commits(
                    project_name, repo_name, from_hash, change.get("toHash")
                )
            except ApiHostError:
                raise BadRequest(detail="Unable to reach host")
            except ApiUnauthorized:
                raise BadRequest()
            except Exception as e:
                sentry_sdk.capture_exception(e)
                raise

            for commit in commits:
                if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                    continue

                author_email = commit["author"]["emailAddress"]

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
                    with transaction.atomic(router.db_for_write(Commit)):
                        Commit.objects.create(
                            repository_id=repo.id,
                            organization_id=organization.id,
                            key=commit["id"],
                            message=commit["message"],
                            author=author,
                            date_added=datetime.fromtimestamp(
                                commit["authorTimestamp"] / 1000, timezone.utc
                            ),
                        )

                except IntegrityError:
                    pass


@region_silo_view
class BitbucketServerWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    _handlers: dict[str, type[BitbucketServerWebhook]] = {"repo:refs_changed": PushEventWebhook}

    def get_handler(self, event_type) -> type[BitbucketServerWebhook] | None:
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest, organization_id, integration_id) -> HttpResponseBase:
        try:
            organization: Organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.exception(
                "%s.webhook.invalid-organization",
                PROVIDER_NAME,
                extra={"organization_id": organization_id, "integration_id": integration_id},
            )
            return HttpResponse(status=400)

        body = bytes(request.body)
        if not body:
            logger.error(
                "%s.webhook.missing-body", PROVIDER_NAME, extra={"organization_id": organization.id}
            )
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_EVENT_KEY"])
        except KeyError:
            logger.exception(
                "%s.webhook.missing-event",
                PROVIDER_NAME,
                extra={"organization_id": organization.id, "integration_id": integration_id},
            )
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            event = orjson.loads(body)
        except orjson.JSONDecodeError:
            logger.exception(
                "%s.webhook.invalid-json",
                PROVIDER_NAME,
                extra={"organization_id": organization.id, "integration_id": integration_id},
            )
            return HttpResponse(status=400)

        event_handler = handler()

        with IntegrationWebhookEvent(
            interaction_type=event_handler.event_type,
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            provider_key=event_handler.provider,
        ).capture():
            event_handler(event, organization=organization, integration_id=integration_id)

        return HttpResponse(status=204)
