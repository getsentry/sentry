import pytest

from sentry.snuba.metrics.fields.histogram import rebucket_histogram


def _call(data, histogram_from, histogram_to, histogram_buckets, output):
    return pytest.param(
        dict(
            data=data,
            histogram_from=histogram_from,
            histogram_to=histogram_to,
            histogram_buckets=histogram_buckets,
        ),
        output,
        id=f"f({data}, {histogram_from}, {histogram_to}, {histogram_buckets})",
    )


@pytest.mark.parametrize(
    "kwargs,output",
    [
        _call([], None, None, 0, output=[]),
        _call([(1, 2, 3)], None, None, 0, output=[]),
        _call([(1, 2, 3)], 5, 6, 1, output=[(5.0, 6.0, 0)]),
        _call([(1, 2, 3)], 0, 0, 1, output=[(0.0, 0.0, 0)]),
        _call([(1, 2, 3)], 0, 1, 1, output=[(0.0, 1.0, 0)]),
        _call([(1, 2, 3)], 0, 1.5, 1, output=[(0.0, 1.5, 2)]),
        _call([(1, 2, 3)], 0, 2, 1, output=[(0.0, 2.0, 3)]),
    ],
)
def test_basic(kwargs, output):
    assert rebucket_histogram(**kwargs) == output
