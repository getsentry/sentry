from __future__ import absolute_import

from sentry.constants import SentryAppStatus
from sentry.testutils import TestCase
from sentry.models import ApiApplication, SentryApp


class SentryAppTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.proxy = self.create_user()
        self.application = ApiApplication.objects.create(owner=self.proxy)

        self.sentry_app = SentryApp(
            application=self.application,
            name="NullDB",
            proxy_user=self.proxy,
            owner=self.org,
            scope_list=("project:read",),
            webhook_url="http://example.com",
        )

    def test_paranoid(self):
        self.sentry_app.save()
        self.sentry_app.delete()
        assert self.sentry_app.date_deleted is not None
        assert self.sentry_app not in SentryApp.objects.all()

    def test_date_updated(self):
        self.sentry_app.save()
        date_updated = self.sentry_app.date_updated
        self.sentry_app.save()
        assert not self.sentry_app.date_updated == date_updated

    def test_related_names(self):
        self.sentry_app.save()
        assert self.sentry_app.application.sentry_app == self.sentry_app
        assert self.sentry_app.proxy_user.sentry_app == self.sentry_app
        assert self.sentry_app in self.sentry_app.owner.owned_sentry_apps.all()

    def test_is_unpublished(self):
        self.sentry_app.status = SentryAppStatus.UNPUBLISHED
        self.sentry_app.save()
        assert self.sentry_app.is_unpublished

    def test_is_published(self):
        self.sentry_app.status = SentryAppStatus.PUBLISHED
        self.sentry_app.save()
        assert self.sentry_app.is_published

    def test_is_internal(self):
        self.sentry_app.status = SentryAppStatus.INTERNAL
        self.sentry_app.save()
        assert self.sentry_app.is_internal
