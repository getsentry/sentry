from __future__ import absolute_import

import logging

import six

from datetime import datetime
from django.db import IntegrityError, transaction
from django.http import HttpResponse, Http404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from sentry.models import Commit, CommitAuthor, Organization, Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils import json

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:bitbucket_server"


class Webhook(object):
    def __call__(self, organization, integration_id, event):
        raise NotImplementedError

    def update_repo_data(self, repo, event):
        """
        Given a webhook payload, update stored repo data if needed.
        """

        name_from_event = event["repository"]["project"]["key"] + "/" + event["repository"]["slug"]
        if repo.name != name_from_event or repo.config.get("name") != name_from_event:
            repo.update(name=name_from_event, config=dict(repo.config, name=name_from_event))


class PushEventWebhook(Webhook):
    def __call__(self, organization, integration_id, event):
        authors = {}

        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(event["repository"]["id"]),
            )
        except Repository.DoesNotExist:
            raise Http404()

        client = repo.get_provider().get_installation(integration_id, organization.id).get_client()

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        [project_name, repo_name] = repo.name.split("/")

        for change in event["changes"]:
            from_hash = None if change.get("fromHash") == "0" * 40 else change.get("fromHash")
            for commit in client.get_commits(
                project_name, repo_name, from_hash, change.get("toHash")
            ):

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
                    with transaction.atomic():

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


class BitbucketServerWebhookEndpoint(View):
    _handlers = {"repo:refs_changed": PushEventWebhook}

    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super(BitbucketServerWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, organization_id, integration_id):
        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            logger.error(
                PROVIDER_NAME + ".webhook.invalid-organization",
                extra={"organization_id": organization_id, "integration_id": integration_id},
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
                PROVIDER_NAME + ".webhook.missing-event",
                extra={"organization_id": organization.id, "integration_id": integration_id},
            )
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.error(
                PROVIDER_NAME + ".webhook.invalid-json",
                extra={"organization_id": organization.id, "integration_id": integration_id},
                exc_info=True,
            )
            return HttpResponse(status=400)

        handler()(organization, integration_id, event)
        return HttpResponse(status=204)
