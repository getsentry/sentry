from __future__ import absolute_import

import dateutil.parser
import logging
import six

from django.db import IntegrityError, transaction
from django.http import HttpResponse, Http404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.utils import timezone
from simplejson import JSONDecodeError
from uuid import uuid4

from sentry.models import (Commit, CommitAuthor, Organization, Repository)
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils import json

logger = logging.getLogger('sentry.webhooks')

PROVIDER_NAME = 'integrations:gitlab'


def create_webhook_secret(self):
    # following this example
    # https://github.com/getsentry/sentry-plugins/blob/master/src/sentry_plugins/github/plugin.py#L305
    return uuid4().hex + uuid4().hex


class Webhook(object):
    def __call__(self, organization, event):
        raise NotImplementedError

    def create_repo(self, event, organization):
        repo_name = event['repository']['url']
        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(repo_name),
            )
        except Repository.DoesNotExist:
            raise Http404()

        if repo.config.get('name') != repo_name:
            repo.config['name'] = repo_name
            repo.save()

        return repo

    def create_commits(self, event, organization, repo):
        authors = {}
        for commit in event.get('commits', []):
            if IntegrationRepositoryProvider.should_ignore_commit(commit['message']):
                continue

            author_email = commit['author']['email']

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if author_email is None or len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={'name': commit['author']['name']}
                )[0]
            else:
                author = authors[author_email]
            try:
                with transaction.atomic():

                    Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=commit['id'],
                        message=commit['message'],
                        author=author,
                        date_added=dateutil.parser.parse(
                            commit['timestamp'],
                        ).astimezone(timezone.utc),
                    )

            except IntegrityError:
                pass


class MergeEventWebhook(Webhook):
    def __call__(self, organization, event):
        repo = self.create_repo(event, organization)
        self.create_commits(event, organization, repo)


class PushEventWebhook(Webhook):
    def __call__(self, organization, event):
        repo = self.create_repo(event, organization)
        self.create_commits(event, organization, repo)


class GitlabWebhookEndpoint(View):
    _handlers = {
        'repository_update': PushEventWebhook,
        'merge_request': MergeEventWebhook,
    }

    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != 'POST':
            return HttpResponse(status=405)

        return super(GitlabWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, organization_id):
        try:
            organization = Organization.objects.get_from_cache(
                id=organization_id,
            )
        except Organization.DoesNotExist:
            logger.error(
                PROVIDER_NAME + '.webhook.invalid-organization',
                extra={
                    'organization_id': organization_id,
                }
            )
            return HttpResponse(status=400)

        body = six.binary_type(request.body)
        if not body:
            logger.error(
                PROVIDER_NAME + '.webhook.missing-body', extra={
                    'organization_id': organization.id,
                }
            )
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META['HTTP_X_EVENT_KEY'])
        except KeyError:
            logger.error(
                PROVIDER_NAME + '.webhook.missing-event', extra={
                    'organization_id': organization.id,
                }
            )
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            event = json.loads(body.decode('utf-8'))
        except JSONDecodeError:
            logger.error(
                PROVIDER_NAME + '.webhook.invalid-json',
                extra={
                    'organization_id': organization.id,
                },
                exc_info=True
            )
            return HttpResponse(status=400)

        handler()(organization, event)
        return HttpResponse(status=204)
