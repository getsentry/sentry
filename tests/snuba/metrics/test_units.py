import pytest

from sentry.snuba.metrics.units import format_value_using_unit
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class TestUnitsUtils(TestCase):
    def test_format_value_using_unit(self):
        assert format_value_using_unit(543200, "nanosecond") == "0.54 ms"
        assert format_value_using_unit(54320, "microsecond") == "54.32 ms"
        assert format_value_using_unit(123456, "millisecond") == "2.06 m"
        assert format_value_using_unit(1, "second") == "1 s"
        assert format_value_using_unit(0.55823414213, "second") == "558.23 ms"
        assert format_value_using_unit(45, "minute") == "45 m"
        assert format_value_using_unit(24, "hour") == "1 d"
        assert format_value_using_unit(3, "day") == "3 d"
        assert format_value_using_unit(1, "week") == "1 wk"
        assert format_value_using_unit(600, "byte") == "600 B"
        assert format_value_using_unit(2048, "kibibyte") == "1.95 MB"
        assert format_value_using_unit(3072, "mebibyte") == "2.86 GB"
        assert format_value_using_unit(3072, "gibibyte") == "2.79 TB"
        assert format_value_using_unit(4096, "tebibyte") == "3.64 PB"
        assert format_value_using_unit(51, "pebibyte") == "45.30 PB"
        assert format_value_using_unit(1, "exbibyte") == "888.18 PB"
        assert format_value_using_unit(4096, "kilobyte") == "4.00 MB"
        assert format_value_using_unit(3145728, "megabyte") == "3.00 TB"
        assert format_value_using_unit(3072, "megabyte") == "3.00 GB"
        assert format_value_using_unit(4096, "gigabyte") == "4.00 TB"
        assert format_value_using_unit(5120, "terabyte") == "5.00 PB"
        assert format_value_using_unit(6144, "petabyte") == "6.00 EB"
        assert format_value_using_unit(7168, "exabyte") == "7.00 ZB"
