import random

import pytest

from sentry.utils.time_window import TimeWindow, remove_time_windows, union_time_windows


@pytest.mark.parametrize(
    "start, end, expected",
    [
        pytest.param(0, 0, 0),
        pytest.param(0, 1, 1.0 * 1000),
        pytest.param(10.0, 90.0, 80.0 * 1000),
    ],
)
def test_time_window_duration(start, end, expected):
    time_window = TimeWindow(start, end)
    assert time_window.duration_ms == expected


union_time_windows_test_cases = [
    pytest.param(
        [(0, 1), (2, 3), (4, 5), (6, 7), (8, 9)],
        [(0, 1), (2, 3), (4, 5), (6, 7), (8, 9)],
        id="non_overlapping",
    ),
    pytest.param([(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)], [(0, 5)], id="all_edges_overlapping"),
    pytest.param(
        [(0, 2), (1, 3), (2, 4), (3, 5), (4, 6)], [(0, 6)], id="all_intervals_overlapping"
    ),
    pytest.param([(0, 1), (1, 2), (3, 4), (4, 5)], [(0, 2), (3, 5)], id="some_edges_overlapping"),
    pytest.param(
        [(0, 2), (1, 3), (4, 6), (5, 7)], [(0, 3), (4, 7)], id="some_intervals_overlapping"
    ),
    pytest.param(
        [(0, 1), (1, 2), (3, 5), (4, 6), (6, 7)], [(0, 2), (3, 7)], id="mixed_of_different_overlaps"
    ),
]


@pytest.mark.parametrize(
    "time_windows, expected",
    union_time_windows_test_cases
    + [
        # the order of the time windows shouldn't matter,
        # give it a shuffle to generate additional test cases
        pytest.param(
            random.sample(test_case.values[0], len(test_case.values[0])),
            test_case.values[1],
            id=f"shuffled_{test_case.id}",
        )
        for test_case in union_time_windows_test_cases
    ],
)
def test_union_time_windows(time_windows, expected):
    time_window_objs = [TimeWindow(start, end) for start, end in time_windows]
    expected_objs = [TimeWindow(start, end) for start, end in expected]
    assert union_time_windows(time_window_objs) == expected_objs, time_windows


remove_time_windows_test_cases = [
    pytest.param(
        (4, 5), [(0, 1), (1, 2), (3, 4), (6, 7), (7, 8), (8, 9)], [(4, 5)], id="non_overlapping"
    ),
    pytest.param((0, 1), [(0, 1)], [], id="is_source_time_window"),
    pytest.param((1, 3), [(0, 2), (2, 4)], [], id="covers_source_time_window"),
    pytest.param((4, 7), [(3, 5), (6, 8)], [(5, 6)], id="leaves_source_time_window_center"),
    pytest.param((4, 7), [(5, 6)], [(4, 5), (6, 7)], id="leaves_source_time_window_ends"),
    pytest.param(
        (2, 7),
        [(0, 3), (1, 4), (5, 8), (6, 9)],
        [(4, 5)],
        id="covers_source_time_window_ends_multiple_times",
    ),
]


@pytest.mark.parametrize(
    "source_time_window, time_windows, expected",
    remove_time_windows_test_cases
    + [
        # the order of the time windows shouldn't matter,
        # give it a shuffle to generate additional test cases
        pytest.param(
            test_case.values[0],
            random.sample(test_case.values[1], len(test_case.values[1])),
            test_case.values[2],
            id=f"shuffled_{test_case.id}",
        )
        for test_case in remove_time_windows_test_cases
    ],
)
def test_remove_time_windows(source_time_window, time_windows, expected):
    source_time_window_obj = TimeWindow(source_time_window[0], source_time_window[1])
    time_window_objs = [TimeWindow(start, end) for start, end in time_windows]
    expected_objs = [TimeWindow(start, end) for start, end in expected]
    assert (
        remove_time_windows(source_time_window_obj, time_window_objs) == expected_objs
    ), time_windows
