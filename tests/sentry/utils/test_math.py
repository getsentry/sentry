import pytest

from sentry.utils.math import ExponentialMovingAverage, nice_int


@pytest.mark.parametrize(
    "start,stop,expected",
    [
        (0, 1, 0),
        (1, 2, 1),
        (2, 3, 2),
        (3, 6, 5),
        (6, 11, 10),
        (11, 21, 20),
        (21, 26, 25),
        (26, 51, 50),
        (51, 101, 100),
        (101, 121, 120),
        (121, 201, 200),
        (201, 251, 250),
        (251, 501, 500),
        (501, 751, 750),
        (751, 1001, 1000),
        (1001, 1201, 1200),
        (1201, 2001, 2000),
        (2001, 2501, 2500),
        (2501, 5001, 5000),
        (5001, 7501, 7500),
        (7501, 10001, 10000),
        (10001, 12001, 12000),
        (12001, 20001, 20000),
        (20001, 25001, 25000),
        (25001, 50001, 50000),
        (50001, 75001, 75000),
        (75001, 100001, 100000),
    ],
)
def test_nice_int(start, stop, expected):
    for x in range(start, stop):
        assert nice_int(x) == expected, "{} was rounded to {}, not {}".format(
            x, nice_int(x), expected
        )
        assert nice_int(-x) == -expected, "{} was rounded to {}, not {}".format(
            -x, nice_int(-x), -expected
        )


@pytest.mark.parametrize(
    "sequence,expected",
    [
        ([], 0),
        ([1], 1),
        ([1 for _ in range(10)], 1),
        ([i for i in range(10)], 5.239),
    ],
)
def test_exponential_moving_average(sequence, expected):
    avg = ExponentialMovingAverage(2 / 11)
    t = 0.0
    for i, x in enumerate(sequence):
        t = avg.update(i, t, x)
    assert t == pytest.approx(expected, abs=1e-3)
