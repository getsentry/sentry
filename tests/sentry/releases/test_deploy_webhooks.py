from __future__ import annotations

from datetime import datetime
from datetime import timezone as dt_timezone
from unittest.mock import MagicMock, patch

from sentry.models.deploy import Deploy
from sentry.releases.deploy_webhooks import (
    build_deploy_webhook_payload,
    send_deploy_created_webhook,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json

DEPLOY_WEBHOOKS_FEATURE = "organizations:deploy-webhooks"


class DeployWebhookTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.environment = self.create_environment(project=self.project, name="production")
        self.release = self.create_release(project=self.project, version="1.0.0")

    def make_deploy(self, **kwargs) -> Deploy:
        kwargs.setdefault("date_finished", datetime(2026, 8, 14, 12, 0, 0, tzinfo=dt_timezone.utc))
        return self.create_deploy(release=self.release, environment=self.environment, **kwargs)


class BuildDeployWebhookPayloadTest(DeployWebhookTestBase):
    def test_payload_shape(self) -> None:
        deploy = self.make_deploy(name="my-deploy", url="https://example.com/build/1")

        payload = build_deploy_webhook_payload(deploy, [self.project], self.organization)

        assert payload == {
            "deploy": {
                "id": str(deploy.id),
                "environment": "production",
                "dateStarted": None,
                "dateFinished": "2026-08-14T12:00:00+00:00",
                "name": "my-deploy",
                "url": "https://example.com/build/1",
                "release": {"version": "1.0.0"},
                "projects": [{"slug": self.project.slug}],
                "web_url": self.organization.absolute_url(
                    f"/organizations/{self.organization.slug}/releases/1.0.0/",
                    query="environment=production",
                ),
            }
        }

    def test_web_url_is_an_absolute_sentry_link(self) -> None:
        payload = build_deploy_webhook_payload(
            self.make_deploy(), [self.project], self.organization
        )

        web_url = payload["deploy"]["web_url"]
        assert web_url.startswith("http")
        assert "/releases/1.0.0/" in web_url
        assert "environment=production" in web_url

    def test_web_url_quotes_url_unsafe_release_versions(self) -> None:
        """`?`, `#` and spaces are all legal in release versions (only BAD_RELEASE_CHARS
        are rejected), so an unquoted version would corrupt the permalink."""
        release = self.create_release(project=self.project, version="v1.0 rc#2?x=1")
        deploy = self.create_deploy(release=release, environment=self.environment)

        web_url = build_deploy_webhook_payload(deploy, [self.project], self.organization)["deploy"][
            "web_url"
        ]

        assert "/releases/v1.0%20rc%232%3Fx%3D1/" in web_url
        # The version must not leak out of its path segment into the query string.
        assert web_url.endswith("?environment=production")

    def test_web_url_omits_environment_query_when_unknown(self) -> None:
        deploy = self.make_deploy()
        # An environment row that no longer resolves serializes to environment=None.
        deploy.update(environment_id=123456789)

        web_url = build_deploy_webhook_payload(deploy, [self.project], self.organization)["deploy"][
            "web_url"
        ]

        assert "environment=" not in web_url
        assert web_url.endswith("/releases/1.0.0/")

    def test_date_started_is_serialized_when_present(self) -> None:
        deploy = self.make_deploy(
            date_started=datetime(2026, 8, 14, 11, 30, 0, tzinfo=dt_timezone.utc)
        )

        payload = build_deploy_webhook_payload(deploy, [self.project], self.organization)

        assert payload["deploy"]["dateStarted"] == "2026-08-14T11:30:00+00:00"

    def test_payload_is_json_serializable(self) -> None:
        """The payload is handed to a task and JSON-encoded for delivery, so it must
        contain no datetime objects."""
        deploy = self.make_deploy(
            date_started=datetime(2026, 8, 14, 11, 30, 0, tzinfo=dt_timezone.utc)
        )

        payload = build_deploy_webhook_payload(deploy, [self.project], self.organization)

        assert json.loads(json.dumps(payload)) == payload

    def test_projects_reflects_the_deployed_subset_not_the_whole_release(self) -> None:
        """A deploy may target a subset of the release's projects, so the payload must
        report the projects passed in rather than everything on the release."""
        other_project = self.create_project(organization=self.organization)
        self.release.add_project(other_project)

        payload = build_deploy_webhook_payload(
            self.make_deploy(), [self.project], self.organization
        )

        assert payload["deploy"]["projects"] == [{"slug": self.project.slug}]


@patch("sentry.releases.deploy_webhooks.broadcast_webhooks_for_organization.delay")
class SendDeployCreatedWebhookTest(DeployWebhookTestBase):
    def test_enqueues_when_feature_enabled(self, delay: MagicMock) -> None:
        deploy = self.make_deploy()

        with self.feature(DEPLOY_WEBHOOKS_FEATURE):
            send_deploy_created_webhook(deploy, [self.project])

        delay.assert_called_once_with(
            resource_name="deploy",
            event_name="created",
            organization_id=self.organization.id,
            payload=build_deploy_webhook_payload(deploy, [self.project], self.organization),
        )

    def test_does_not_enqueue_when_feature_disabled(self, delay: MagicMock) -> None:
        deploy = self.make_deploy()

        with self.feature({DEPLOY_WEBHOOKS_FEATURE: False}):
            send_deploy_created_webhook(deploy, [self.project])

        assert not delay.called

    def test_swallows_and_logs_payload_failures(self, delay: MagicMock) -> None:
        deploy = self.make_deploy()

        with (
            self.feature(DEPLOY_WEBHOOKS_FEATURE),
            patch(
                "sentry.releases.deploy_webhooks.build_deploy_webhook_payload",
                side_effect=ValueError("boom"),
            ),
            patch("sentry.releases.deploy_webhooks.logger") as mock_logger,
        ):
            send_deploy_created_webhook(deploy, [self.project])

        assert not delay.called
        mock_logger.exception.assert_called_once()
        assert mock_logger.exception.call_args[0][0] == "releases.deploy.webhook.failed"
