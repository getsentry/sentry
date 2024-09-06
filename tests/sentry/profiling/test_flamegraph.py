import pytest
from snuba_sdk import And, Column, Condition, Op, Or

from sentry.profiles.flamegraph import get_chunk_snuba_conditions_from_spans_metadata


@pytest.mark.parametrize(
    ["span_metadata", "expected_condition"],
    [
        (
            {
                "0000": [
                    {"start": "1", "end": "2"},
                    {"start": "5", "end": "7"},
                ]
            },
            [
                And(
                    [
                        Condition(Column("profiler_id"), Op.EQ, "0000"),
                        Or(
                            [
                                And(
                                    [
                                        Condition(Column("end_timestamp"), Op.GTE, "1"),
                                        Condition(Column("start_timestamp"), Op.LT, "2"),
                                    ]
                                ),
                                And(
                                    [
                                        Condition(Column("end_timestamp"), Op.GTE, "5"),
                                        Condition(Column("start_timestamp"), Op.LT, "7"),
                                    ]
                                ),
                            ]
                        ),  # end Or
                    ]
                )
            ],  # end And
        ),
        (
            {
                "1111": [
                    {"start": "1", "end": "2"},
                ]
            },
            [
                And(
                    [
                        Condition(Column("profiler_id"), Op.EQ, "1111"),
                        And(
                            [
                                Condition(Column("end_timestamp"), Op.GTE, "1"),
                                Condition(Column("start_timestamp"), Op.LT, "2"),
                            ]
                        ),
                    ]
                )
            ],  # end And
        ),
        (
            {
                "1111": [
                    {"start": "1", "end": "2"},
                ],
                "2222": [
                    {"start": "1", "end": "2"},
                ],
            },
            [
                Or(
                    [
                        And(
                            [
                                Condition(Column("profiler_id"), Op.EQ, "1111"),
                                And(
                                    [
                                        Condition(Column("end_timestamp"), Op.GTE, "1"),
                                        Condition(Column("start_timestamp"), Op.LT, "2"),
                                    ]
                                ),
                            ]
                        ),
                        And(
                            [
                                Condition(Column("profiler_id"), Op.EQ, "2222"),
                                And(
                                    [
                                        Condition(Column("end_timestamp"), Op.GTE, "1"),
                                        Condition(Column("start_timestamp"), Op.LT, "2"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
        ),
    ],
)
def test_get_chunk_snuba_conditions_from_spans_metadata(span_metadata, expected_condition):
    condition = get_chunk_snuba_conditions_from_spans_metadata(span_metadata)
    assert condition == expected_condition
