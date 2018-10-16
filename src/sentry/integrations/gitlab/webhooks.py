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

from sentry.models import (
    Commit,
    CommitAuthor,
    Integration,
    PullRequest,
    Repository,
)
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils import json

logger = logging.getLogger('sentry.webhooks')

PROVIDER_NAME = 'integrations:gitlab'


class Webhook(object):
    def __call__(self, integration, organization, event):
        raise NotImplementedError

    def get_repo(self, integration, organization, event):
        repo_name = event['project']['path_with_namespace']
        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(repo_name),
            )
        except Repository.DoesNotExist:
            logger.info('gitlab.webhook.missing-repo', extra={
                'external_id': repo_name
            })
            raise Http404()
        return repo


class MergeEventWebhook(Webhook):
    def __call__(self, integration, organization, event):
        repo = self.get_repo(integration, organization, event)
        try:
            number = event['object_attributes']['iid']
            title = event['object_attributes']['title']
            body = event['object_attributes']['description']
            created_at = event['object_attributes']['created_at']
            merge_commit_sha = event['object_attributes']['merge_commit_sha']

            author = event['object_attributes']['last_commit']['author']
            author_email = author['email']
            author_name = author['name']
        except KeyError as e:
            logger.info(
                'gitlab.webhook.invalid-merge-data',
                extra={
                    'error': six.string_type(e)
                })
            raise Http404()

        author = CommitAuthor.objects.get_or_create(
            organization_id=organization.id,
            email=author_email,
            defaults={'name': author_name}
        )[0]

        try:
            PullRequest.objects.create_or_update(
                repository_id=repo.id,
                key=number,
                values={
                    'organization_id': organization.id,
                    'title': title,
                    'author': author,
                    'message': body,
                    'merge_commit_sha': merge_commit_sha,
                    'date_added': dateutil.parser.parse(
                        created_at).astimezone(timezone.utc),
                },
            )
        except IntegrityError:
            pass


class PushEventWebhook(Webhook):
    def __call__(self, integration, organization, event):
        repo = self.get_repo(integration, organization, event)

        authors = {}

        # TODO gitlab only sends a max of 20 commits. If a push contains
        # more commits they provide a total count and require additional API
        # requests to fetch the commit details
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


class GitlabWebhookEndpoint(View):
    provider = 'gitlab'

    _handlers = {
        'Push Hook': PushEventWebhook,
        'Merge Request Hook': MergeEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != 'POST':
            return HttpResponse(status=405)

        return super(GitlabWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request):
        try:
            integration = Integration.objects.filter(
                provider=self.provider,
                external_id=request.META['HTTP_X_GITLAB_TOKEN']
            ).prefetch_related('organizations').get()
        except Integration.DoesNotExist:
            logger.info(
                'gitlab.webhook.invalid-organization',
                extra={
                    'external_id': request.META['HTTP_X_GITLAB_TOKEN'],
                }
            )
            return HttpResponse(status=400)

        if integration.organizations.count() != 1:
            logger.info(
                'gitlab.webhook.extra-organizations',
                extra={
                    'count': len(integration.organizations),
                    'external_id': integration.external_id,
                }
            )
            return HttpResponse(status=400)

        try:
            event = json.loads(request.body.decode('utf-8'))
        except JSONDecodeError:
            logger.info(
                'gitlab.webhook.invalid-json',
                extra={
                    'external_id': integration.external_id
                }
            )
            return HttpResponse(status=400)

        try:
            handler = self._handlers[request.META['HTTP_X_GITLAB_EVENT']]
        except KeyError:
            logger.info('gitlab.webhook.missing-event', extra={
                'event': request.META['HTTP_X_GITLAB_EVENT']
            })
            return HttpResponse(status=400)

        handler()(integration, integration.organizations.first(), event)
        return HttpResponse(status=204)
