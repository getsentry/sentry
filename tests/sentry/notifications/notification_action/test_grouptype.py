from sentry.notifications.notification_action.grouptype import get_test_notification_event_data
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TestGetTestNotificationEventData(TestCase):
    def test_returns_group_event_with_occurrence(self):
        project = self.create_project()
        group_event = get_test_notification_event_data(project)

        assert group_event is not None
        assert group_event.occurrence is not None
        assert group_event.occurrence.issue_title == "Test Issue"

    def test_email_subject_uses_occurrence_title(self):
        project = self.create_project()
        group_event = get_test_notification_event_data(project)

        assert group_event is not None
        short_id = group_event.group.qualified_short_id
        assert group_event.get_email_subject() == f"{short_id} - Test Issue"
