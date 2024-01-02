import pytest

from sentry.sentry_metrics.querying.utils import fnv1a_32


@pytest.mark.parametrize(
    ("value, expected_value"),
    (
        ("c:transactions/count_per_root_project@none", 2684394786),
        ("d:transactions/duration@millisecond", 1147819254),
        ("s:transactions/user@none", 1739810785),
        ("c:custom/user.click@none", 1248146441),
        ("d:custom/page.load@millisecond", 2103554973),
        ("s:custom/username@none", 670706478),
    ),
)
def test_fnv1a_32_with_mris(value, expected_value):
    assert fnv1a_32(value.encode("utf-8")) == expected_value
