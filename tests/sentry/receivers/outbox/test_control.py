from unittest.mock import patch

import responses
from django.test import RequestFactory
from pytest import raises
from rest_framework import status

from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.models.user import User
from sentry.receivers.outbox.control import (
    process_api_application_updates,
    process_async_webhooks,
    process_integration_updates,
    process_organization_integration_update,
    process_sentry_app_installation_updates,
    process_user_updates,
)
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test(stable=True)
class ProcessControlOutboxTest(TestCase):
    identifier = 1
    region = Region("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_user_updates(self, mock_maybe_process):
        mock_maybe_process.return_value = User(id=1, is_active=True)
        process_user_updates(object_identifier=self.identifier, region_name="us")
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

    @responses.activate
    def test_process_async_webhooks_success(self):
        with override_regions(self.region_config):
            request = RequestFactory().post(
                "/extensions/github/webhook/",
                data={"installation": {"id": "github:1"}},
                content_type="application/json",
                HTTP_X_GITHUB_EMOTICON=">:^]",
            )
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=request,
            )
            outbox.save()
            outbox.refresh_from_db()

            mock_response = responses.add(
                request.method,
                f"{self.region.address}{request.path}",
                status=status.HTTP_200_OK,
            )
            process_async_webhooks(payload=outbox.payload, region_name=self.region.name)
            request_claim = (
                mock_response.call_count == 1
                if SiloMode.get_current_mode() == SiloMode.CONTROL
                else mock_response.call_count == 0
            )
            assert request_claim

    @responses.activate
    def test_process_async_webhooks_failure(self):
        with override_regions(self.region_config):
            request = RequestFactory().post(
                "/extensions/github/webhook/",
                data={"installation": {"id": "github:1"}},
                content_type="application/json",
                HTTP_X_GITHUB_EMOTICON=">:^]",
            )
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=request,
            )
            outbox.save()
            outbox.refresh_from_db()

            mock_response = responses.add(
                request.method,
                f"{self.region.address}{request.path}",
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                with raises(ApiError):
                    process_async_webhooks(payload=outbox.payload, region_name=self.region.name)
                assert mock_response.call_count == 1
            else:
                process_async_webhooks(payload=outbox.payload, region_name=self.region.name)
                assert mock_response.call_count == 0
