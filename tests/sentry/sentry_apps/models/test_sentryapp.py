from sentry.constants import SentryAppStatus
from sentry.hybridcloud.models.outbox import ControlOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us", "eu"))
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
            owner_id=self.org.id,
            scope_list=("project:read",),
            webhook_url="http://example.com",
            slug="nulldb",
        )
        self.sentry_app.save()

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
        assert self.sentry_app.application is not None
        assert self.sentry_app.proxy_user is not None
        assert self.sentry_app.application.sentry_app == self.sentry_app
        assert self.sentry_app.proxy_user.sentry_app == self.sentry_app

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

    def test_is_installed_on(self):
        other_app = self.create_sentry_app()
        self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, prevent_token_exchange=True
        )
        assert self.sentry_app.is_installed_on(self.org)
        assert not other_app.is_installed_on(self.org)

    def test_not_installed_on_org(self):
        other_org = self.create_organization()
        self.create_sentry_app_installation(
            organization=other_org, slug=self.sentry_app.slug, prevent_token_exchange=True
        )
        assert not self.sentry_app.is_installed_on(self.org)

    def test_save_outbox_update(self):
        # Clear the outbox created in setup()
        ControlOutbox.objects.filter(category=OutboxCategory.SENTRY_APP_UPDATE).delete()

        self.sentry_app.update(name="NoneDB")
        outboxes = ControlOutbox.objects.filter(category=OutboxCategory.SENTRY_APP_UPDATE).all()
        assert len(outboxes) == 2
        assert outboxes[0].shard_identifier == self.sentry_app.id
        assert outboxes[0].region_name

    def test_regions_with_installations(self):
        self.us_org = self.create_organization(name="us test name", region="us")
        self.create_sentry_app_installation(
            organization=self.us_org, slug=self.sentry_app.slug, prevent_token_exchange=True
        )
        assert self.sentry_app.regions_with_installations() == {"us"}

        self.eu_org = self.create_organization(name="eu test name", region="eu")
        self.create_sentry_app_installation(
            organization=self.eu_org, slug=self.sentry_app.slug, prevent_token_exchange=True
        )
        assert self.sentry_app.regions_with_installations() == {"us", "eu"}
