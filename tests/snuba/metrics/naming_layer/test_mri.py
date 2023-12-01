from typing import cast

import pytest

from sentry.snuba.metrics.naming_layer.mri import format_mri_field
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class TestMRIUtils(TestCase):
    def test_format_mri_field(self):
        assert format_mri_field("avg(c:custom/foo@none)") == "avg(foo)"
        assert format_mri_field("max(s:spans/user@none)") == "max(user)"
        assert format_mri_field("sum(d:spans/exclusive_time@millisecond)") == "sum(exclusive_time)"
        assert format_mri_field("invalid_mri_field") == "invalid_mri_field"
        assert format_mri_field(cast(str, None)) is None
