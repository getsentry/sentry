from __future__ import absolute_import

import responses

from mock import patch

from sentry.mediators.sentry_app_installations import Creator
from sentry.models import ApiAuthorization, ApiGrant, ServiceHook, ServiceHookProject
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        responses.add(responses.POST, 'https://example.com/webhook')

        self.sentry_app = self.create_sentry_app(
            name='nulldb',
            organization=self.org,
            scopes=('project:read',),
            events=('issue.created', ),
        )

        self.creator = Creator(
            organization=self.org,
            slug='nulldb',
            user=self.user,
        )

    @responses.activate
    def test_creates_api_authorization(self):
        responses.add(responses.POST, 'https://example.com/webhook')
        self.creator.call()

        assert ApiAuthorization.objects.filter(
            application=self.sentry_app.application,
            user=self.sentry_app.proxy_user,
            scopes=self.sentry_app.scopes,
        ).exists()

    @responses.activate
    def test_creates_installation(self):
        responses.add(responses.POST, 'https://example.com/webhook')
        install = self.creator.call()
        assert install.pk

    @responses.activate
    def test_creates_api_grant(self):
        responses.add(responses.POST, 'https://example.com/webhook')
        install = self.creator.call()
        assert ApiGrant.objects.filter(id=install.api_grant_id).exists()

    @responses.activate
    def test_creates_service_hooks(self):
        responses.add(responses.POST, 'https://example.com/webhook')
        install = self.creator.call()

        hook = ServiceHook.objects.get(organization_id=self.org.id)

        assert hook.application_id == self.sentry_app.application.id
        assert hook.actor_id == install.id
        assert hook.organization_id == self.org.id
        assert hook.events == self.sentry_app.events
        assert hook.url == self.sentry_app.webhook_url

        assert not ServiceHookProject.objects.all()

    @responses.activate
    @patch('sentry.mediators.sentry_app_installations.InstallationNotifier.run')
    def test_notifies_service(self, run):
        with self.tasks():
            responses.add(responses.POST, 'https://example.com/webhook')
            install = self.creator.call()
            run.assert_called_once_with(install=install, user=self.user, action='created')

    @responses.activate
    def test_associations(self):
        responses.add(responses.POST, 'https://example.com/webhook')
        install = self.creator.call()

        assert install.api_grant is not None
        assert install.authorization is not None
