from sentry.integrations.slack.threads.activity_notifications import AssignedActivityNotification
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class _BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.assigned_activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.ASSIGNED.value,
            user_id=self.user.id,
            data={
                "assignee": self.user.id,
            },
        )
        self.obj = AssignedActivityNotification(self.assigned_activity)


class TestGetDescription(_BaseTestCase):
    def test_returns_correct_template(self) -> None:
        template, _, _ = self.obj.get_description()
        assert template == "{author} assigned this issue to {assignee}"


class TestDescriptionAsTest(_BaseTestCase):
    def test_returns_correct_text(self) -> None:
        template, _, params = self.obj.get_description()
        text = self.obj.description_as_text(template, params)
        assert text == "admin@localhost assigned this issue to themselves"
