from sentry.integrations.slack.threads.activity_notifications import (
    _AsanaExternalIssueCreatedActivity,
)
from tests.sentry.integrations.slack.threads.activity_notifications import BaseTestCase


class TestGetTicketNumber(BaseTestCase):
    def test_returns_base_value_when_exists(self) -> None:
        ticket_number_value = "ABC-123"
        self.activity.data = {"label": ticket_number_value}

        create_issue_activity = _AsanaExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_ticket_number()

        assert ret == ticket_number_value

    def test_returns_empty_with_no_link(self) -> None:
        self.activity.data = {"label": "Asana Issue"}
        create_issue_activity = _AsanaExternalIssueCreatedActivity(self.activity)

        ret = create_issue_activity.get_ticket_number()
        assert ret == ""

    def test_returns_last_part_of_link(self) -> None:
        last_part = "ABC-123"
        self.activity.data = {"location": f"www.example.com/{last_part}"}

        create_issue_activity = _AsanaExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_ticket_number()

        assert ret == last_part

    def test_returns_last_part_of_link_with_multiple_slashes(self) -> None:
        last_part = "ABC-123"
        self.activity.data = {"location": f"www.example.com/abc/something/whatever/{last_part}"}

        create_issue_activity = _AsanaExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_ticket_number()

        assert ret == last_part

    def test_accounts_for_trailing_slash(self) -> None:
        last_part = "ABC-123"
        self.activity.data = {"location": f"www.example.com/{last_part}/"}

        create_issue_activity = _AsanaExternalIssueCreatedActivity(self.activity)
        ret = create_issue_activity.get_ticket_number()

        assert ret == last_part
