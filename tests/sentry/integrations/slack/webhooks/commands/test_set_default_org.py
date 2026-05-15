from unittest.mock import MagicMock, patch

from sentry.identity.slack.provider import PREFERRED_ORGANIZATION_ID_KEY
from sentry.integrations.slack.webhooks.command import (
    SET_DEFAULT_ORG_MISSING_SLUG_MESSAGE,
    SET_DEFAULT_ORG_NOT_FOUND_MESSAGE,
    SET_DEFAULT_ORG_SUCCESS_MESSAGE,
    UNSET_DEFAULT_ORG_SUCCESS_MESSAGE,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


class SlackCommandsSetDefaultOrgTest(SlackCommandsTest):
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sets_preference_for_linked_org(self, mock_record: MagicMock) -> None:
        self.link_user()
        data = self.send_slack_message(f"set org {self.organization.slug}")

        assert SET_DEFAULT_ORG_SUCCESS_MESSAGE.format(slug=self.organization.slug) in (
            get_response_text(data)
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            identity = Identity.objects.get(external_id=self.slack_id)
        assert identity.data.get(PREFERRED_ORGANIZATION_ID_KEY) == self.organization.id
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_halts_when_identity_not_linked(self, mock_record: MagicMock) -> None:
        data = self.send_slack_message(f"set org {self.organization.slug}")
        assert "You must first link your identity" in get_response_text(data)
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_halts_when_slug_missing(self, mock_record: MagicMock) -> None:
        self.link_user()
        data = self.send_slack_message("set org")
        assert SET_DEFAULT_ORG_MISSING_SLUG_MESSAGE in get_response_text(data)
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_halts_when_user_not_member(self, mock_record: MagicMock) -> None:
        self.link_user()
        other = self.create_organization(slug="some-other-org")
        data = self.send_slack_message(f"set org {other.slug}")
        assert SET_DEFAULT_ORG_NOT_FOUND_MESSAGE.format(slug=other.slug) in get_response_text(data)
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)


class SlackCommandsUnsetDefaultOrgTest(SlackCommandsTest):
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_clears_preference(self, mock_record: MagicMock) -> None:
        self.link_user()
        with assume_test_silo_mode(SiloMode.CONTROL):
            identity = Identity.objects.get(external_id=self.slack_id)
            identity.update(data={PREFERRED_ORGANIZATION_ID_KEY: self.organization.id})

        data = self.send_slack_message("unset org")
        assert UNSET_DEFAULT_ORG_SUCCESS_MESSAGE in get_response_text(data)
        with assume_test_silo_mode(SiloMode.CONTROL):
            identity.refresh_from_db()
        assert PREFERRED_ORGANIZATION_ID_KEY not in identity.data
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_preference_set_is_success(self, mock_record: MagicMock) -> None:
        self.link_user()
        data = self.send_slack_message("unset org")
        assert UNSET_DEFAULT_ORG_SUCCESS_MESSAGE in get_response_text(data)
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_halts_when_identity_not_linked(self, mock_record: MagicMock) -> None:
        data = self.send_slack_message("unset org")
        assert "You must first link your identity" in get_response_text(data)
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
