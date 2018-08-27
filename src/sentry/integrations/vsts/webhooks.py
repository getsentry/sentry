from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import CommitAuthor, Identity, Integration, OrganizationIntegration, PullRequest, Repository, sync_group_assignee_inbound
from sentry.api.base import Endpoint

from uuid import uuid4
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction

import re
import six

UNSET = object()
# Pull email from the string: u'lauryn <lauryn@sentry.io>'
EMAIL_PARSER = re.compile(r'<(.*)>')
PROVIDER_NAME = 'vsts'


class Webhook(object):
    def __call__(self, data, integration):
        raise NotImplementedError


class WorkItemWebhook(Webhook):

    def __call__(self, data, integration):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        status_change = data['resource']['fields'].get('System.State')
        project = data['resourceContainers']['project']['id']
        self.handle_assign_to(integration, external_issue_key, assigned_to)
        self.handle_status_change(
            integration,
            external_issue_key,
            status_change,
            project)

    def handle_assign_to(self, integration, external_issue_key, assigned_to):
        if not assigned_to:
            return
        new_value = assigned_to.get('newValue')
        if new_value is not None:
            email = self.parse_email(new_value)
            assign = True
        else:
            email = None
            assign = False
        sync_group_assignee_inbound(
            integration=integration,
            email=email,
            external_issue_key=external_issue_key,
            assign=assign,
        )

    def handle_status_change(self, integration, external_issue_key,
                             status_change, project):
        if status_change is None:
            return

        organization_ids = OrganizationIntegration.objects.filter(
            integration_id=integration.id,
        ).values_list('organization_id', flat=True)

        for organization_id in organization_ids:
            installation = integration.get_installation(organization_id)
            data = {
                'new_state': status_change['newValue'],
                'old_state': status_change['oldValue'],
                'project': project,
            }
            installation.sync_status_inbound(external_issue_key, data)


class PullRequestWebhook(Webhook):
    def __call__(self, data, integration):
        organization_ids = OrganizationIntegration.objects.filter(
            integration_id=integration.id,
        ).values_list('organization_id', flat=True)
        for organization_id in organization_ids:
            installation = integration.get_installation(organization_id)
            repo = self.get_or_create_repo(data, installation, organization_id)
            author = self.get_or_create_author(data, installation, organization_id)
            self.create_pull_request(data, repo, author)

    def get_or_create_repo(self, data, installation, organization_id):
        try:
            repo = Repository.objects.get(
                organization_id=organization_id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(data['resource']['repository']['id']),
            )
        except Repository.DoesNotExist as e:
            installation.logger.error(
                e,
                extra={
                    'integration_id': installation.model.id,
                    'organization_id': organization_id,
                }
            )
        return repo

    def get_or_create_author(self, data, installation, organization_id):
        author_email = data['createdBy']['uniqueName']
        author_id = data['createdBy']['id']
        author_name = data['createdBy']['displayName']
        try:
            commit_author = CommitAuthor.objects.get(
                external_id=author_id,
                organization_id=organization_id,
                email=author_email,
            )
        except CommitAuthor.DoesNotExist:
            try:
                identity = Identity.objects.get(
                    external_id=author_id,
                    idp__type=self.provider,
                    idp__external_id=data['account']['id'],
                )
            except Identity.DoesNotExist:
                with transaction.atomic():
                    commit_author = CommitAuthor.objects.create(
                        external_id=author_id,
                        organization_id=organization_id,
                        email=author_email,
                        name=author_name,
                    )
            else:
                with transaction.atomic():
                    commit_author = CommitAuthor.objects.create(
                        external_id=author_id,
                        organization_id=organization_id,
                        email=identity.user.email,
                        name=author_name,
                    )

        return commit_author

    def create_pull_request(self, data, repo, author, organization_id):
        merge_commit_sha = data['lastMergeCommit']['commitId']
        try:
            PullRequest.objects.create_or_update(
                repository_id=repo.id,
                key=data['id'],
                values={
                    'organization_id': organization_id,
                    'title': data['title'],
                    'author': author,
                    'message': data['message']['html'],
                    'merge_commit_sha': merge_commit_sha,
                },
            )
        except IntegrityError:
            pass


class WebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    handlers = {
        'workitem.updated': WorkItemWebhook,
        'git.pullrequest.merged': PullRequestWebhook,
    }

    def get_client(self, identity, oauth_redirect_url):
        return VstsApiClient(identity, oauth_redirect_url)

    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(WebhookEndpoint, self).dispatch(request, *args, **kwargs)

    def is_secret_valid(self, request, integration):
        return integration.metadata['subscription']['secret'] == request.META['HTTP_SHARED_SECRET']

    def post(self, request, *args, **kwargs):
        data = request.DATA
        integration = Integration.objects.get(
            provider='vsts',
            external_id=data['resourceContainers']['collection']['id'],
        )
        if self.is_secret_valid(request, integration):
            self.logger.info(
                'vsts.invalid-subscription-secret',
                extra={
                    # TODO(lb): What else should go here?
                    'integration_id': integration.id,
                }
            )
            return self.respond(status=401)

        handler = self.get_handler('eventType')
        handler()(data, integration)
        return self.respond()

    def create_webhook_secret(self):
        # following this example
        # https://github.com/getsentry/sentry-plugins/blob/master/src/sentry_plugins/github/plugin.py#L305
        return uuid4().hex + uuid4().hex

    def parse_email(self, email):
        return EMAIL_PARSER.search(email).group(1)

    def create_subscription(self, instance, identity_data, oauth_redirect_url, external_id):
        client = self.get_client(Identity(data=identity_data), oauth_redirect_url)
        shared_secret = self.create_webhook_secret()
        return client.create_subscription(instance, external_id, shared_secret), shared_secret
