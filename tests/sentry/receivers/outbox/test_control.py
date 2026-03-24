from unittest.mock import MagicMock, patch

from sentry.integrations.models.integration import Integration
from sentry.models.apiapplication import ApiApplication
from sentry.receivers.outbox.control import (
    process_api_application_updates,
    process_identity_updates,
    process_integration_updates,
    process_sentry_app_updates,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, RegionCategory
from sentry.users.models.identity import Identity

_TEST_CELL = Cell("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)


@control_silo_test(cells=[_TEST_CELL])
class ProcessControlOutboxTest(TestCase):
    identifier = 1

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_integration_updates(self, mock_maybe_process: MagicMock) -> None:
        process_integration_updates(object_identifier=self.identifier, region_name=_TEST_CELL.name)
        mock_maybe_process.assert_called_with(
            Integration, self.identifier, cell_name=_TEST_CELL.name
        )

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_identity_updates(self, mock_maybe_process: MagicMock) -> None:
        process_identity_updates(object_identifier=self.identifier, region_name=_TEST_CELL.name)
        mock_maybe_process.assert_called_with(Identity, self.identifier, cell_name=_TEST_CELL.name)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_api_application_updates(self, mock_maybe_process: MagicMock) -> None:
        process_api_application_updates(
            object_identifier=self.identifier, region_name=_TEST_CELL.name
        )
        mock_maybe_process.assert_called_with(
            ApiApplication, self.identifier, cell_name=_TEST_CELL.name
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.cell_caching_service")
    def test_process_sentry_app_updates(self, mock_caching: MagicMock) -> None:
        org = self.create_organization()
        sentry_app = self.create_sentry_app()
        install = self.create_sentry_app_installation(slug=sentry_app.slug, organization=org)
        install_dupe = self.create_sentry_app_installation(slug=sentry_app.slug, organization=org)

        org_two = self.create_organization()
        install_two = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=org_two
        )

        with self.tasks():
            process_sentry_app_updates(object_identifier=sentry_app.id, region_name=_TEST_CELL.name)
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_installation:{install.id}", cell_name=_TEST_CELL.name
        )
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_installation:{install_dupe.id}", cell_name=_TEST_CELL.name
        )
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_installation:{install_two.id}", cell_name=_TEST_CELL.name
        )
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_by_application_id:{sentry_app.application_id}",
            cell_name=_TEST_CELL.name,
        )
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_installed_for_organization:{org.id}",
            cell_name=_TEST_CELL.name,
        )
        mock_caching.clear_key.assert_any_call(
            key=f"app_service.get_installed_for_organization:{org_two.id}",
            cell_name=_TEST_CELL.name,
        )
