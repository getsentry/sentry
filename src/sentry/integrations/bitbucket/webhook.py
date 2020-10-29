from __future__ import absolute_import

import dateutil.parser
import logging
import six
import re

import ipaddress

from django.db import IntegrityError, transaction
from django.http import HttpResponse, Http404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.utils import timezone
from sentry.models import Commit, CommitAuthor, Organization, Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils import json

logger = logging.getLogger("sentry.webhooks")

# Bitbucket Cloud IP range:
# https://confluence.atlassian.com/bitbucket/manage-webhooks-735643732.html#Managewebhooks-trigger_webhookTriggeringwebhooks
BITBUCKET_IP_RANGES = (
    ipaddress.ip_network(u"104.192.136.0/21"),
    # Not documented in the webhook docs, but defined here:
    # https://bitbucket.org/blog/new-ip-addresses-bitbucket-cloud
    ipaddress.ip_network(u"18.205.93.0/25"),
    ipaddress.ip_network(u"18.234.32.128/25"),
    ipaddress.ip_network(u"13.52.5.0/25"),
)
BITBUCKET_IPS = [u"34.198.203.127", u"34.198.178.64", u"34.198.32.85"]
PROVIDER_NAME = "integrations:bitbucket"


def parse_raw_user_email(raw):
    # captures content between angle brackets
    match = re.search("(?<=<).*(?=>$)", raw)
    if match is None:
        return
    return match.group(0)


def parse_raw_user_name(raw):
    # captures content before angle bracket
    return raw.split("<")[0].strip()


class Webhook(object):
    def __call__(self, organization, event):
        raise NotImplementedError

    def update_repo_data(self, repo, event):
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
        url_from_event = u"https://bitbucket.org/{}".format(name_from_event)

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


class PushEventWebhook(Webhook):
    # https://confluence.atlassian.com/bitbucket/event-payloads-740262817.html#EventPayloads-Push
    def __call__(self, organization, event):
        authors = {}

        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(event["repository"]["uuid"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        for change in event["push"]["changes"]:
            for commit in change.get("commits", []):
                if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                    continue

                author_email = parse_raw_user_email(commit["author"]["raw"])

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
                    with transaction.atomic():

                        Commit.objects.create(
                            repository_id=repo.id,
                            organization_id=organization.id,
                            key=commit["hash"],
                            message=commit["message"],
                            author=author,
                            date_added=dateutil.parser.parse(commit["date"]).astimezone(
                                timezone.utc
                            ),
                        )

                except IntegrityError:
                    pass


class BitbucketWebhookEndpoint(View):
    _handlers = {"repo:push": PushEventWebhook}

    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super(BitbucketWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, organization_id):
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.error(
                PROVIDER_NAME + ".webhook.invalid-organization",
                extra={"organization_id": organization_id},
            )
            return HttpResponse(status=400)

        body = six.binary_type(request.body)
        if not body:
            logger.error(
                PROVIDER_NAME + ".webhook.missing-body", extra={"organization_id": organization.id}
            )
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_EVENT_KEY"])
        except KeyError:
            logger.error(
                PROVIDER_NAME + ".webhook.missing-event", extra={"organization_id": organization.id}
            )
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        address_string = six.text_type(request.META["REMOTE_ADDR"])
        ip = ipaddress.ip_address(address_string)
        valid_ip = False
        for ip_range in BITBUCKET_IP_RANGES:
            if ip in ip_range:
                valid_ip = True
                break

        if not valid_ip and address_string not in BITBUCKET_IPS:
            logger.error(
                PROVIDER_NAME + ".webhook.invalid-ip-range",
                extra={"organization_id": organization.id},
            )
            return HttpResponse(status=401)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.error(
                PROVIDER_NAME + ".webhook.invalid-json",
                extra={"organization_id": organization.id},
                exc_info=True,
            )
            return HttpResponse(status=400)

        handler()(organization, event)
        return HttpResponse(status=204)
