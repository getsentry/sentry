import ipaddress
import logging
from datetime import timezone

from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import Http404, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.request import Request

from sentry.integrations.bitbucket.constants import BITBUCKET_IP_RANGES, BITBUCKET_IPS
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.plugins.providers import RepositoryProvider
from sentry.services.hybrid_cloud.organization.service import organization_service
from sentry.utils import json
from sentry.utils.email import parse_email

logger = logging.getLogger("sentry.webhooks")


class Webhook:
    def __call__(self, organization, event):
        raise NotImplementedError


class PushEventWebhook(Webhook):
    # https://confluence.atlassian.com/bitbucket/event-payloads-740262817.html#EventPayloads-Push
    def __call__(self, organization_id: int, event):
        authors = {}

        try:
            repo = Repository.objects.get(
                organization_id=organization_id,
                provider="bitbucket",
                external_id=str(event["repository"]["uuid"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        if repo.config.get("name") != event["repository"]["full_name"]:
            repo.config["name"] = event["repository"]["full_name"]
            repo.save()

        for change in event["push"]["changes"]:
            for commit in change.get("commits", []):
                if RepositoryProvider.should_ignore_commit(commit["message"]):
                    continue

                author_email = parse_email(commit["author"]["raw"])

                # TODO(dcramer): we need to deal with bad values here, but since
                # its optional, lets just throw it out for now
                if author_email is None or len(author_email) > 75:
                    author = None
                elif author_email not in authors:
                    authors[author_email] = author = CommitAuthor.objects.get_or_create(
                        organization_id=organization_id,
                        email=author_email,
                        defaults={"name": commit["author"]["raw"].split("<")[0].strip()},
                    )[0]
                else:
                    author = authors[author_email]
                try:
                    with transaction.atomic(router.db_for_write(Commit)):
                        Commit.objects.create(
                            repository_id=repo.id,
                            organization_id=organization_id,
                            key=commit["hash"],
                            message=commit["message"],
                            author=author,
                            date_added=parse_date(commit["date"]).astimezone(timezone.utc),
                        )

                except IntegrityError:
                    pass


class BitbucketPluginWebhookEndpoint(View):
    _handlers = {"repo:push": PushEventWebhook}

    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> HttpResponseBase:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, organization_id: int):
        org_exists = organization_service.check_organization_by_id(
            id=organization_id, only_visible=True
        )
        if not org_exists:
            logger.error(
                "bitbucket.webhook.invalid-organization", extra={"organization_id": organization_id}
            )
            return HttpResponse(status=400)

        body = bytes(request.body)
        if not body:
            logger.error(
                "bitbucket.webhook.missing-body", extra={"organization_id": organization_id}
            )
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_EVENT_KEY"])
        except KeyError:
            logger.exception(
                "bitbucket.webhook.missing-event", extra={"organization_id": organization_id}
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
                "bitbucket.webhook.invalid-ip-range", extra={"organization_id": organization_id}
            )
            return HttpResponse(status=401)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.exception(
                "bitbucket.webhook.invalid-json",
                extra={"organization_id": organization_id},
            )
            return HttpResponse(status=400)

        handler()(organization_id, event)
        return HttpResponse(status=204)
