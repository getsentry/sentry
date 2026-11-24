from unittest import mock

import sentry.hybridcloud.rpc.caching as caching_module
from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.outbox import ControlOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.apiapplication import ApiApplication
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test
from sentry.types.cell import get_cell_for_organization
from sentry.workflow_engine.models import Action


@control_silo_test
class SentryAppInstallationTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.proxy = self.create_user()
        self.org = self.create_organization()
        self.application = ApiApplication.objects.create(owner=self.proxy)

        self.sentry_app = SentryApp.objects.create(
            application=self.application,
            name="NullDB",
            proxy_user=self.proxy,
            owner_id=self.org.id,
            scope_list=("project:read",),
            webhook_url="http://example.com",
        )

        self.install = SentryAppInstallation(
            sentry_app=self.sentry_app, organization_id=self.org.id
        )

    def test_paranoid(self) -> None:
        self.install.save()
        self.install.delete()
        assert self.install.date_deleted is not None
        assert self.install not in SentryAppInstallation.objects.all()

    @override_options({"sentry-apps.disable-paranoia": True})
    def test_paranoid_querying_disabled(self) -> None:
        self.install.save()
        self.install.delete()
        assert self.install.date_deleted is not None
        assert self.install in SentryAppInstallation.objects.all()

    def test_date_updated(self) -> None:
        self.install.save()
        date_updated = self.install.date_updated
        self.install.save()
        assert not self.install.date_updated == date_updated

    def test_related_names(self) -> None:
        self.install.save()
        assert self.install in self.install.sentry_app.installations.all()
        assert self.install in SentryAppInstallation.objects.filter(
            organization_id=self.install.organization_id
        )

    def test_handle_async_replication_clears_region_cache(self) -> None:
        with mock.patch.object(caching_module, "cell_caching_service") as mock_caching_service:
            self.install.save()
            cell = get_cell_for_organization(self.org.slug)
            mock_caching_service.clear_key.assert_any_call(
                key=f"app_service.get_installation:{self.install.id}", cell_name=cell.name
            )


@control_silo_test
class SentryAppInstallationAsyncDeleteTest(TestCase):
    OPTION = "hybridcloud.outbox.sentry_app_installation_delete_async.enabled"

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.sentry_app = self.create_sentry_app(organization=self.org)
        self.install = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org
        )
        self.install_id = self.install.id
        self.action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        dcg = self.create_data_condition_group(organization=self.org)
        self.create_data_condition_group_action(action=self.action, condition_group=dcg)

    def _delete(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            self.install.delete()

    def _pending_categories(self) -> set[OutboxCategory]:
        return {
            OutboxCategory(category)
            for category in ControlOutbox.objects.filter(
                shard_scope=OutboxScope.APP_SCOPE,
                shard_identifier=self.sentry_app.application_id,
                object_identifier=self.install_id,
            ).values_list("category", flat=True)
        }

    def _action_status(self) -> int:
        with assume_test_silo_mode_of(Action):
            self.action.refresh_from_db()
        return self.action.status

    def test_option_off_drains_on_commit(self) -> None:
        self._delete()

        assert self._pending_categories() == set()
        assert self._action_status() == ObjectStatus.DISABLED

    def test_option_on_drains_async(self) -> None:
        with self.options({self.OPTION: True}):
            self._delete()

        assert self._pending_categories() == {
            OutboxCategory.SENTRY_APP_INSTALLATION_DELETE,
            OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
        }
        assert self._action_status() == ObjectStatus.ACTIVE

        with outbox_runner():
            pass

        assert self._pending_categories() == set()
        assert self._action_status() == ObjectStatus.DISABLED

    def test_option_on_hard_delete_drains_async(self) -> None:
        with self.options({self.OPTION: True, "sentry-apps.hard-delete": True}):
            self._delete()

        assert self._pending_categories() == {
            OutboxCategory.SENTRY_APP_INSTALLATION_DELETE,
            OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
        }
        assert not SentryAppInstallation.with_deleted.filter(id=self.install_id).exists()
