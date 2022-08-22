from sentry.tasks.user_report import user_report
from sentry.testutils import TestCase


class UserReportTest(TestCase):
    def test_task_persistent_name(self):
        assert user_report.name == "sentry.tasks.user_report"
