from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import Commit, CommitAuthor, Identity, Integration, OrganizationIntegration, PullRequest, Repository, sync_group_assignee_inbound
from sentry.api.base import Endpoint

from uuid import uuid4
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.http import Http404


import dateutil
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
        organization_id = None  # TODO(lb): where is this supposed to come from???? :(((())))
        repo = self.get_or_create_repo(data, integration, organization_id)
        author_email = self.get_or_create_author(data, integration)
        self.create_commit_and_pull_request(data, repo, integration, author_email)

    def get_or_create_repo(self, data, integration, organization_id):
        try:
            repo = Repository.objects.get(
                organization_id=organization_id,
                provider=PROVIDER_NAME,
                external_id=six.text_type(data['resource']['repository']['id']),
            )
        except Repository.DoesNotExist:
            raise Http404()
        # TODO(lb): double check that we store ProjectName/RepoName in the database
        # if repo.config.get('name') != event['repository']['full_name']:
        #     repo.config['name'] = event['repository']['full_name']
        #     repo.save()
        return repo

    def get_or_create_author(self, data, integration, commit_author, organization_id):
        author_email = data['createdBy']['uniqueName']
        user_id = data['createdBy']['id']
        try:
            commit_author = CommitAuthor.objects.get(
                external_id=user_id,
                # TODO(lb): WHHHHHHHYYYYY?????!?!?!??!
                organization_id=organization_id,
            )
            author_email = commit_author.email
        except CommitAuthor.DoesNotExist:
            try:
                identity = Identity.objects.get(
                    external_id=user_id,
                    idp__type=self.provider,
                    idp__external_id=data['account']['id'],
                )
            except Identity.DoesNotExist:
                # TODO(lb): shouldn't I be creating the commit author if there is both no commit author and no idenity?
                # TODO(lb): race condition, vulnerable should maybe use atomic?
                commit_author = CommitAuthor.objects.create(
                    external_id=user_id,
                    # TODO(lb): WHHHHHHHYYYYY?????!?!?!??!
                    organization_id=organization_id,
                )
            else:
                author_email = identity.user.email

        return author_email

    def create_commit_and_pull_request(self, data, repo, author, organization_id):
        merge_commit_sha = data['lastMergeCommit']['commitId']
        try:
            with transaction.atomic():
                Commit.objects.create(
                    repository_id=repo.id,
                    organization_id=organization_id,
                    key=merge_commit_sha,
                    message=data['message']['html'],
                    author=author,
                    date_added=dateutil.parser.parse(
                        data['createdDate'],
                    ).astimezone(timezone.utc),
                )

        except IntegrityError:
            pass

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
