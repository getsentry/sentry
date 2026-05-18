from unittest import mock

from sentry.models.options.project_option import ProjectOption
from sentry.sentry_apps.services.legacy_webhook.service import (
    build_legacy_webhook_payload,
    send_legacy_webhooks_for_project,
    split_urls,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TestSplitUrls(TestCase):
    def test_splits_newline_separated(self) -> None:
        assert split_urls("http://a.com\nhttp://b.com") == ["http://a.com", "http://b.com"]

    def test_empty_string(self) -> None:
        assert split_urls("") == []

    def test_strips_whitespace(self) -> None:
        assert split_urls("  http://a.com  \n  http://b.com  ") == [
            "http://a.com",
            "http://b.com",
        ]

    def test_filters_blank_lines(self) -> None:
        assert split_urls("http://a.com\n\nhttp://b.com\n") == ["http://a.com", "http://b.com"]


class TestBuildLegacyWebhookPayload(TestCase):
    def test_build_payload_matches_legacy_plugin(self) -> None:
        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        group = event.group
        assert group is not None

        payload = build_legacy_webhook_payload(group, event, ["my rule"])

        assert payload["id"] == str(group.id)
        assert payload["project"] == self.project.slug
        assert payload["project_name"] == self.project.name
        assert payload["project_slug"] == self.project.slug
        assert payload["level"] == "warning"
        assert payload["message"] == "Hello world"
        assert payload["triggering_rules"] == ["my rule"]
        assert payload["event"]["event_id"] == event.event_id
        assert payload["event"]["id"] == event.event_id
        assert "tags" in payload["event"]


class TestSendLegacyWebhooksForProject(TestCase):
    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_dispatches_task_per_url(self, mock_task: mock.MagicMock) -> None:
        event = self.store_event(
            data={"message": "test", "level": "error"}, project_id=self.project.id
        )
        group = event.group
        assert group is not None

        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com\nhttp://b.com")

        send_legacy_webhooks_for_project(self.project, group, event, ["rule1"])

        assert mock_task.delay.call_count == 2
        urls_called = {call.kwargs["url"] for call in mock_task.delay.call_args_list}
        assert urls_called == {"http://a.com", "http://b.com"}
        for call in mock_task.delay.call_args_list:
            assert call.kwargs["organization_id"] == self.project.organization_id

    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    )
    def test_no_urls_configured_is_noop(self, mock_task: mock.MagicMock) -> None:
        event = self.store_event(
            data={"message": "test", "level": "error"}, project_id=self.project.id
        )
        group = event.group
        assert group is not None

        send_legacy_webhooks_for_project(self.project, group, event, ["rule1"])

        assert mock_task.delay.call_count == 0
