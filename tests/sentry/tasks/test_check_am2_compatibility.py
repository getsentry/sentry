from sentry.tasks.check_am2_compatibility import run_compatibility_check_async
from sentry.testutils import TestCase


class CheckAM2CompatibilityTest(TestCase):
    def test_check_simple(self):
        run_compatibility_check_async(org_id=self.organization.id)
