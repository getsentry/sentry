from typing import TypedDict

import pytest
from _pytest.mark.structures import ParameterSet

from sentry.snuba.metrics.fields.histogram import ClickhouseHistogram, rebucket_histogram


class _CallKwargs(TypedDict):
    data: ClickhouseHistogram
    histogram_from: float | None
    histogram_to: float | None
    histogram_buckets: int


def _call(
    data: ClickhouseHistogram,
    histogram_from: float | None,
    histogram_to: float | None,
    histogram_buckets: int,
    output: ClickhouseHistogram,
) -> ParameterSet:
    return pytest.param(
        _CallKwargs(
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
def test_basic(kwargs: _CallKwargs, output: ClickhouseHistogram) -> None:
    assert rebucket_histogram(**kwargs) == output
