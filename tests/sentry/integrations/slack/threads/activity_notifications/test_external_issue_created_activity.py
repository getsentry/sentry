import pytest

from sentry.integrations.slack.threads.activity_notifications import _ExternalIssueCreatedActivity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from tests.sentry.integrations.slack.threads.activity_notifications import BaseTestCase


class TestInit(TestCase):
    def test_throws_error_on_invalid_activity_type(self) -> None:
        with pytest.raises(Exception):
            self.activity.type = 500
            _ExternalIssueCreatedActivity(self.activity)

    def test_throws_error_on_unsupported_activity_type(self) -> None:
        with pytest.raises(Exception):
            self.activity.type = ActivityType.ASSIGNED
            _ExternalIssueCreatedActivity(self.activity)

    def test_success(self) -> None:
        self.activity.type = ActivityType.CREATE_ISSUE
        obj = _ExternalIssueCreatedActivity(self.activity)
        assert obj is not None


class TestGetLink(BaseTestCase):
    def test_when_link_key_is_not_in_map(self) -> None:
        self.activity.data = {}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_link()
        assert ret == ""

    def test_when_link_key_is_empty(self) -> None:
        self.activity.data = {"location": None}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_link()
        assert ret == ""

    def test_returns_correct_value(self) -> None:
        link_value = "www.example.com"
        self.activity.data = {"location": link_value}

        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_link()

        assert ret == link_value


class TestGetProvider(BaseTestCase):
    def test_returns_fallback_when_provider_key_is_not_in_map(self) -> None:
        self.activity.data = {}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_provider()
        assert ret == create_issue_activity.DEFAULT_PROVIDER_FALLBACK_TEXT

    def test_returns_fallback_when_provider_key_is_empty(self) -> None:
        self.activity.data = {"provider": None}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_provider()
        assert ret == create_issue_activity.DEFAULT_PROVIDER_FALLBACK_TEXT

    def test_returns_correct_value(self) -> None:
        provider_value = "whatever"
        self.activity.data = {"provider": provider_value}

        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_provider()

        assert ret == provider_value

    def test_returns_lowercase_value(self) -> None:
        provider_value = "WHATEVER"
        self.activity.data = {"provider": provider_value}

        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_provider()

        assert ret == provider_value.lower()


class TestGetTicketNumber(BaseTestCase):
    def test_when_ticket_number_key_is_not_in_map(self) -> None:
        self.activity.data = {}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_ticket_number()
        assert ret == ""

    def test_when_ticket_number_key_is_empty(self) -> None:
        self.activity.data = {"label": None}
        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_ticket_number()
        assert ret == ""

    def test_returns_correct_value(self) -> None:
        ticket_number_value = "ABC-123"
        self.activity.data = {"label": ticket_number_value}

        create_issue_activity = _ExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_ticket_number()

        assert ret == ticket_number_value
