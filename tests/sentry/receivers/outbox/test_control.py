from unittest.mock import patch

from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.receivers.outbox.control import (
    process_api_application_updates,
    process_integration_updates,
    process_organization_integration_update,
    process_sentry_app_installation_updates,
    process_user_updates,
)
from sentry.testutils import TestCase


class ProcessControlOutboxTest(TestCase):
    identifier = 1

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_user_updates(self, mock_maybe_process):
        process_user_updates(object_identifier=self.identifier)
        mock_maybe_process.assert_called_with(User, self.identifier)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_integration_updatess(self, mock_maybe_process):
        process_integration_updates(object_identifier=self.identifier)
        mock_maybe_process.assert_called_with(Integration, self.identifier)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_api_application_updates(self, mock_maybe_process):
        process_api_application_updates(object_identifier=self.identifier)
        mock_maybe_process.assert_called_with(ApiApplication, self.identifier)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_sentry_app_installation_updates(self, mock_maybe_process):
        process_sentry_app_installation_updates(object_identifier=self.identifier)
        mock_maybe_process.assert_called_with(SentryAppInstallation, self.identifier)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_organization_integration_update(self, mock_maybe_process):
        process_organization_integration_update(object_identifier=self.identifier)
        mock_maybe_process.assert_called_with(OrganizationIntegration, self.identifier)

    def test_process_async_webhooks(self):
        # process_async_webhooks
        pass
