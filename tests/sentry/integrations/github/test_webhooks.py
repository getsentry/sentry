# -*- coding: utf-8 -*-
from __future__ import absolute_import

import six

from datetime import datetime, timedelta
from django.utils import timezone
from sentry.models import (
    Commit,
    CommitAuthor,
    Integration,
    PullRequest,
    Repository)
from sentry.testutils import APITestCase
from uuid import uuid4

from .testutils import (
    PUSH_EVENT_EXAMPLE_INSTALLATION, PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE, PULL_REQUEST_CLOSED_EVENT_EXAMPLE
)
from sentry import options

from mock import patch


class WebhookTest(APITestCase):
    def test_get(self):

        url = '/extensions/github/webhook/'

        response = self.client.get(url)

        assert response.status_code == 405

    def test_unregistered_event(self):
        project = self.project  # force creation
        url = '/extensions/github/webhook/'.format(
            project.organization.id,
        )

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='UnregisteredEvent',
            HTTP_X_HUB_SIGNATURE='sha1=56a3df597e02adbc17fb617502c70e19d96a6136',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

    def test_invalid_signature_event(self):

        url = '/extensions/github/webhook/'

        secret = '2d7565c3537847b789d6995dca8d9f84'

        options.set('github-app.webhook-secret', secret)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='push',
            HTTP_X_HUB_SIGNATURE='sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 401


class PushEventWebhookTest(APITestCase):

    @patch('sentry.integrations.github.client.get_jwt')
    def test_simple(self, mock_get_jwt):
        mock_get_jwt.return_value = ""

        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)
        Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            external_id="12345",
            provider='github',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='push',
            HTTP_X_HUB_SIGNATURE='sha1=56a3df597e02adbc17fb617502c70e19d96a6136',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(
                # organization_id=project.organization_id,
            ).select_related('author').order_by('-date_added')
        )

        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == '133d60480286590a610a0eb7352ff6e02b9674c4'
        assert commit.message == u'Update README.md (àgain)'
        assert commit.author.name == u'bàxterthehacker'
        assert commit.author.email == 'baxterthehacker@users.noreply.github.com'
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == '0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c'
        assert commit.message == 'Update README.md'
        assert commit.author.name == u'bàxterthehacker'
        assert commit.author.email == 'baxterthehacker@users.noreply.github.com'
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

    def test_anonymous_lookup(self):
        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            provider='github',
            external_id='12345',
            name='octocat',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        CommitAuthor.objects.create(
            external_id='github:baxterthehacker',
            organization_id=project.organization_id,
            email='baxterthehacker@example.com',
            name=u'bàxterthehacker',
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='push',
            HTTP_X_HUB_SIGNATURE='sha1=56a3df597e02adbc17fb617502c70e19d96a6136',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(
                organization_id=project.organization_id,
            ).select_related('author').order_by('-date_added')
        )

        # should be skipping the #skipsentry commit
        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == '133d60480286590a610a0eb7352ff6e02b9674c4'
        assert commit.message == u'Update README.md (àgain)'
        assert commit.author.name == u'bàxterthehacker'
        assert commit.author.email == 'baxterthehacker@example.com'
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == '0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c'
        assert commit.message == 'Update README.md'
        assert commit.author.name == u'bàxterthehacker'
        assert commit.author.email == 'baxterthehacker@example.com'
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

    @patch('sentry.integrations.github.client.get_jwt')
    def test_multiple_orgs(self, mock_get_jwt):
        mock_get_jwt.return_value = ""

        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)
        Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            external_id="12345",
            provider='github',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        org2 = self.create_organization()
        project2 = self.create_project(organization=org2, name='bar')

        Repository.objects.create(
            organization_id=project2.organization.id,
            external_id='77',
            provider='integrations:github',
            name='another/repo',
        )

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            external_id="99",
            provider='github',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(org2.id)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='push',
            HTTP_X_HUB_SIGNATURE='sha1=56a3df597e02adbc17fb617502c70e19d96a6136',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(
                organization_id=project.organization_id,
            ).select_related('author').order_by('-date_added')
        )

        assert len(commit_list) == 2

        commit_list = list(
            Commit.objects.filter(
                organization_id=org2.id,
            ).select_related('author').order_by('-date_added')
        )
        assert len(commit_list) == 0


class PullRequestEventWebhook(APITestCase):
    def test_opened(self):
        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'
        options.set('github-app.webhook-secret', secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            provider='github',
            external_id='12345',
            name='octocat',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='pull_request',
            HTTP_X_HUB_SIGNATURE='sha1=5b82806b2c96eb546b2898f0dca98cc326d7d9ae',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id,
            organization_id=project.organization.id,
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == '1'
        assert pr.message == u'This is a pretty simple change that we need to pull into master.'
        assert pr.title == u'Update the README with new information'
        assert pr.author.name == u'baxterthehacker'

    def test_edited(self):
        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            provider='github',
            external_id='12345',
            name='octocat',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        pr = PullRequest.objects.create(
            key='1',
            repository_id=repo.id,
            organization_id=project.organization.id,
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_EDITED_EVENT_EXAMPLE,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='pull_request',
            HTTP_X_HUB_SIGNATURE='sha1=42e0d5cf6bd7521fcc7576f7e41c31621c88091e',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == '1'
        assert pr.message == u'new edited body'
        assert pr.title == u'new edited title'
        assert pr.author.name == u'baxterthehacker'

    def test_closed(self):
        project = self.project  # force creation

        url = '/extensions/github/webhook/'

        secret = 'b3002c3e321d4b7880360d397db2ccfd'

        options.set('github-app.webhook-secret', secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = Integration.objects.create(
            provider='github',
            external_id='12345',
            name='octocat',
            metadata={'access_token': '1234', 'expires_at': future_expires.isoformat()}
        )
        integration.add_organization(project.organization.id)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id='35129377',
            provider='integrations:github',
            name='baxterthehacker/public-repo',
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type='application/json',
            HTTP_X_GITHUB_EVENT='pull_request',
            HTTP_X_HUB_SIGNATURE='sha1=49db856f5658b365b73a2fa73a7cffa543f4d3af',
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4())
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id,
            organization_id=project.organization.id,
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == '1'
        assert pr.message == u'new closed body'
        assert pr.title == u'new closed title'
        assert pr.author.name == u'baxterthehacker'
        assert pr.merge_commit_sha == '0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c'
