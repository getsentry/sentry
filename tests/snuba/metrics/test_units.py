import pytest

from sentry.snuba.metrics.naming_layer.mri import format_mri_field
from sentry.snuba.metrics.units import format_value_using_unit
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class TestMRIUtils(TestCase):
    def test_format_mri_field(self):
        assert format_mri_field("avg(c:custom/foo@none)") == "avg(foo)"
        assert format_mri_field("max(s:spans/user@none)") == "max(span.user)"
        assert (
            format_mri_field("sum(d:spans/exclusive_time@millisecond)")
            == "sum(span.exclusive_time)"
        )
        assert format_mri_field("invalid_mri_field") == "invalid_mri_field"

    def test_format_value_using_unit(self):
        assert format_value_using_unit(1, "second") == "1.0 s"
        assert format_value_using_unit(0.55823414213, "second") == "558.23 ms"
        assert format_value_using_unit(123456, "millisecond") == "2.06 m"
        assert format_value_using_unit(5000, "second") == "1.39 h"
        assert format_value_using_unit(600, "byte") == "600 B"
        assert format_value_using_unit(4096, "kilobyte") == "4.00 MB"
        assert format_value_using_unit(3145728, "megabyte") == "3.00 TB"


2
