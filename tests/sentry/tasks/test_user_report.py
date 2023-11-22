from sentry.tasks.user_report import user_report
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserReportTest(TestCase):
    def test_task_persistent_name(self):
        assert user_report.name == "sentry.tasks.user_report"
