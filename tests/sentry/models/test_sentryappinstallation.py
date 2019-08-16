from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import ApiApplication, SentryApp, SentryAppInstallation


class SentryAppInstallationTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.proxy = self.create_user()
        self.org = self.create_organization()
        self.application = ApiApplication.objects.create(owner=self.proxy)

        self.sentry_app = SentryApp.objects.create(
            application=self.application,
            name="NullDB",
            proxy_user=self.proxy,
            owner=self.org,
            scope_list=("project:read",),
            webhook_url="http://example.com",
        )

        self.install = SentryAppInstallation(sentry_app=self.sentry_app, organization=self.org)

    def test_paranoid(self):
        self.install.save()
        self.install.delete()
        assert self.install.date_deleted is not None
        assert self.install not in SentryAppInstallation.objects.all()

    def test_date_updated(self):
        self.install.save()
        date_updated = self.install.date_updated
        self.install.save()
        assert not self.install.date_updated == date_updated

    def test_related_names(self):
        self.install.save()
        assert self.install in self.install.sentry_app.installations.all()
        assert self.install in self.install.organization.sentry_app_installations.all()
