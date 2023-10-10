from unittest.mock import patch

import pytest

from sentry.tasks.check_am2_compatibility import (
    CheckStatus,
    get_check_status,
    run_compatibility_check_async,
)
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class CheckAM2CompatibilityTest(TestCase):
    def test_check_with_success(self):
        with self.tasks():
            run_compatibility_check_async(org_id=self.organization.id)
            assert get_check_status(self.organization.id) == CheckStatus.DONE

    @patch("sentry.tasks.check_am2_compatibility.CheckAM2Compatibility.run_compatibility_check")
    def test_check_with_error(self, run_compatibility_check):
        run_compatibility_check.side_effect = Exception

        with self.tasks():
            run_compatibility_check_async(org_id=self.organization.id)
            assert get_check_status(self.organization.id) == CheckStatus.ERROR
