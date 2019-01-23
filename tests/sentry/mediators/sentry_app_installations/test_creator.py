from __future__ import absolute_import

from mock import patch

from sentry.mediators.sentry_app_installations import Creator
from sentry.models import ApiAuthorization, ApiGrant, ServiceHook
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

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

    def test_creates_api_authorization(self):
        self.creator.call()

        assert ApiAuthorization.objects.filter(
            application=self.sentry_app.application,
            user=self.sentry_app.proxy_user,
            scopes=self.sentry_app.scopes,
        ).exists()

    def test_creates_installation(self):
        install = self.creator.call()
        assert install.pk

    def test_creates_api_grant(self):
        install = self.creator.call()
        assert ApiGrant.objects.filter(id=install.api_grant_id).exists()

    def test_creates_service_hooks(self):
        install = self.creator.call()

        hook = ServiceHook.objects.get(project_id=self.project1.id)

        assert hook.application_id == self.sentry_app.application.id
        assert hook.actor_id == install.id
        assert hook.project_id == self.project1.id
        assert hook.events == self.sentry_app.events
        assert hook.url == self.sentry_app.webhook_url

    def test_creates_service_hooks_for_all_projects(self):
        self.creator.call()

        assert ServiceHook.objects.get(project_id=self.project1.id).events == self.sentry_app.events
        assert ServiceHook.objects.get(project_id=self.project2.id).events == self.sentry_app.events

    @patch('sentry.tasks.sentry_apps.installation_webhook.delay')
    def test_notifies_service(self, installation_webhook):
        install = self.creator.call()
        installation_webhook.assert_called_once_with(install.id, self.user.id)

    def test_associations(self):
        install = self.creator.call()

        assert install.api_grant is not None
        assert install.authorization is not None
