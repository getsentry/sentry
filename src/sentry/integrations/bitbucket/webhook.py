import hashlib
import hmac
import ipaddress
import logging
from abc import ABC
from collections.abc import Mapping
from datetime import timezone
from typing import Any

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import Http404, HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.bitbucket.constants import BITBUCKET_IP_RANGES, BITBUCKET_IPS
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils.email import parse_email

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:bitbucket"


def is_valid_signature(body: bytes, secret: str, signature: str) -> bool:
    hash_object = hmac.new(
        secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    )
    expected_signature = hash_object.hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        logger.info(
            "%s.webhook.invalid-signature",
            PROVIDER_NAME,
            extra={"expected": expected_signature, "given": signature},
        )
        return False
    return True


class WebhookSignatureException(Exception):
    def __init__(self, message: str = ""):
        super().__init__(message)


class BitbucketWebhook(SCMWebhook, ABC):
    @property
    def provider(self) -> str:
        return "bitbucket"

    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]) -> None:
        """
        Given a webhook payload, update stored repo data if needed.

        NB: Assumes event['repository']['full_name'] is defined. Rework this if
        that stops being a safe assumption.
        """

        name_from_event = event["repository"]["full_name"]
        # build the URL manually since it doesn't come back from the API in
        # the form that we need
        # see https://confluence.atlassian.com/bitbucket/event-payloads-740262817.html#EventPayloads-entity_repository
        # and click on 'Repository property' underneath the table for example data
        # (all entries are from the `api` subdomain, rather than bitbucket.org)
        url_from_event = f"https://bitbucket.org/{name_from_event}"

        if (
            repo.name != name_from_event
            or repo.config.get("name") != name_from_event
            or repo.url != url_from_event
        ):
            repo.update(
                name=name_from_event,
                url=url_from_event,
                config=dict(repo.config, name=name_from_event),
            )


class PushEventWebhook(BitbucketWebhook):
    # https://confluence.atlassian.com/bitbucket/event-payloads-740262817.html#EventPayloads-Push

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PUSH

    def __call__(self, event: Mapping[str, Any], **kwargs) -> None:
        authors = {}
        if not (request := kwargs.get("request")):
            raise ValueError("Missing request")

        if not (organization := kwargs.get("organization")):
            raise ValueError("Missing organization")

        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=str(event["repository"]["uuid"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        if "webhook_secret" in repo.config:
            secret = repo.config["webhook_secret"]
            try:
                method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
            except (IndexError, KeyError, ValueError):
                raise WebhookSignatureException("Missing webhook signature")

            if method != "sha256":
                raise WebhookSignatureException("Signature method is not supported")

            if not is_valid_signature(request.body, secret, signature):
                raise WebhookSignatureException("Webhook signature is invalid")

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        for change in event["push"]["changes"]:
            for commit in change.get("commits", []):
                if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                    continue

                author_email = parse_email(commit["author"]["raw"])

                # TODO(dcramer): we need to deal with bad values here, but since
                # its optional, lets just throw it out for now
                if author_email is None or len(author_email) > 75:
                    author = None
                elif author_email not in authors:
                    authors[author_email] = author = CommitAuthor.objects.get_or_create(
                        organization_id=organization.id,
                        email=author_email,
                        defaults={"name": commit["author"]["raw"].split("<")[0].strip()},
                    )[0]
                else:
                    author = authors[author_email]
                try:
                    with transaction.atomic(router.db_for_write(Commit)):
                        Commit.objects.create(
                            repository_id=repo.id,
                            organization_id=organization.id,
                            key=commit["hash"],
                            message=commit["message"],
                            author=author,
                            date_added=parse_date(commit["date"]).astimezone(timezone.utc),
                        )

                except IntegrityError:
                    pass


@region_silo_endpoint
class BitbucketWebhookEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = ()
    _handlers: dict[str, type[BitbucketWebhook]] = {"repo:push": PushEventWebhook}

    def get_handler(self, event_type) -> type[BitbucketWebhook] | None:
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest, organization_id: int) -> HttpResponse:
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.info(
                "%s.webhook.invalid-organization",
                PROVIDER_NAME,
                extra={"organization_id": organization_id},
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
                extra={"organization_id": organization.id},
            )
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        address_string = str(request.META["REMOTE_ADDR"])
        ip = ipaddress.ip_address(address_string)
        valid_ip = False
        for ip_range in BITBUCKET_IP_RANGES:
            if ip in ip_range:
                valid_ip = True
                break

        if not valid_ip and address_string not in BITBUCKET_IPS:
            logger.error(
                "%s.webhook.invalid-ip-range",
                PROVIDER_NAME,
                extra={"organization_id": organization.id},
            )
            return HttpResponse(status=401)

        try:
            event = orjson.loads(body)
        except orjson.JSONDecodeError:
            logger.exception(
                "%s.webhook.invalid-json",
                PROVIDER_NAME,
                extra={"organization_id": organization.id},
            )
            return HttpResponse(status=400)

        event_handler = handler()

        with IntegrationWebhookEvent(
            interaction_type=event_handler.event_type,
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            provider_key=event_handler.provider,
        ).capture():
            try:
                event_handler(event, request=request, organization=organization)
            except WebhookSignatureException as e:
                return HttpResponse(str(e), status=400)

        return HttpResponse(status=204)
