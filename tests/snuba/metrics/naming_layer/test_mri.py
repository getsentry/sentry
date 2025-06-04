from typing import cast

import pytest

from sentry.snuba.metrics.naming_layer.mri import format_mri_field, format_mri_field_value
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class TestMRIUtils(TestCase):
    def test_format_mri_field(self):
        assert format_mri_field("max(s:spans/user@none)") == "max(user)"
        assert format_mri_field("sum(d:spans/exclusive_time@millisecond)") == "sum(exclusive_time)"
        assert format_mri_field("invalid_mri_field") == "invalid_mri_field"
        assert format_mri_field(cast(str, None)) is None

    def test_format_mri_field_value(self):
        assert format_mri_field_value("count(s:spans/user@none)", "100") == "100"
        assert format_mri_field_value("sum(d:spans/exclusive_time@millisecond)", "1000") == "1 s"
        assert format_mri_field_value("invalid_mri_field", "100") == "100"
        assert format_mri_field_value(cast(str, None), "100") == "100"
