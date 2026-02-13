import pytest

from sentry.scm.utils import check_rollout


@pytest.mark.parametrize(
    "cohort,cutoff,expected",
    [
        (0, 0, False),
        (1, 0, False),
        (0.5, 0, False),
        (0, 1, True),
        (0.1, 1, True),
        (0.1, 0.5, True),
        (0.5, 0.5, True),
        (1, 1, True),
    ],
)
def test_check_rollout(cohort: float, cutoff: float, expected: bool):
    assert check_rollout(cohort, cutoff) is expected
