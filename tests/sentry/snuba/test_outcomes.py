from datetime import timedelta

import pytest
from django.http import QueryDict
from django.utils import timezone
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.constants import DataCategory
from sentry.search.utils import InvalidQuery
from sentry.snuba.outcomes import QueryDefinition
from sentry.snuba.sessions_v2 import InvalidField
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.utils.outcomes import Outcome


def _make_query(qs, params=None, allow_minute_resolution=True):
    if params is None:
        params = {}
    return QueryDefinition.from_query_dict(QueryDict(qs), params, allow_minute_resolution)


class OutcomesQueryDefinitionTests(TestCase):
    def test_query_must_have_category(self):
        with pytest.raises(InvalidQuery):
            _make_query("statsPeriod=4d&interval=1d&field=sum(quantity)")

    def test_invalid_field(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&interval=1d&field=sum(badstuff)")

    def test_empty_query(self):
        with pytest.raises(InvalidField):
            _make_query("")

    def test_invalid_groupby(self):
        with pytest.raises(InvalidField):
            _make_query(
                "statsPeriod=4d&interval=1d&field=sum(quantity)&groupBy=category&groupBy=no"
            )

    def test_invalid_category(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&category=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_invalid_reason(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&reason=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_invalid_outcome(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&outcome=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_no_field(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&interval=1d&groupBy=category&groupBy=no")

    def test_no_combined_attachment(self):
        with pytest.raises(InvalidQuery):
            _make_query(
                "statsPeriod=4d&interval=1d&category=error&category=attachment&field=sum(quantity)"
            )

    def test_correct_category_mapping(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&category=error&field=sum(quantity)",
            {"organization_id": 1},
        )

        assert (
            Condition(
                Column("category"),
                Op.IN,
                [DataCategory.DEFAULT, DataCategory.ERROR, DataCategory.SECURITY],
            )
        ) in query.conditions

    def test_correct_reason_mapping(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&groupBy=category&reason=spike_protection&field=sum(quantity)",
            {"organization_id": 1},
        )
        assert Condition(Column("reason"), Op.IN, ["smart_rate_limit"]) in query.conditions

    def test_correct_outcome_mapping(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&groupBy=category&outcome=accepted&field=sum(quantity)",
            {"organization_id": 1},
        )

        assert Condition(Column("outcome"), Op.IN, [Outcome.ACCEPTED]) in query.conditions

    def test_correct_times_seen_aggregate(self):
        query = _make_query(
            "statsPeriod=6h&interval=10m&groupBy=category&field=sum(times_seen)",
            {"organization_id": 1},
            True,
        )
        assert Function("count()", [Column("times_seen")], "times_seen") in query.select_params

        query = _make_query(
            "statsPeriod=6h&interval=1d&groupBy=category&field=sum(times_seen)",
            {"organization_id": 1},
            True,
        )
        assert Function("sum", [Column("times_seen")], "times_seen") in query.select_params

    def test_filter_keys(self):
        query = _make_query(
            "statsPeriod=6h&interval=10m&groupBy=category&field=sum(times_seen)",
            {"organization_id": 1},
            True,
        )
        assert Condition(Column("org_id"), Op.EQ, 1) in query.conditions

        query = _make_query(
            "statsPeriod=6h&interval=1d&groupBy=category&field=sum(times_seen)",
            {"organization_id": 1, "project_id": [1, 2, 3, 4, 5]},
            True,
        )
        assert Condition(Column("org_id"), Op.EQ, 1) in query.conditions
        assert Condition(Column("project_id"), Op.IN, [1, 2, 3, 4, 5]) in query.conditions

    def test_key_id_filter(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&groupBy=category&key_id=12345&field=sum(quantity)",
            {"organization_id": 1},
        )

        assert Condition(Column("key_id"), Op.IN, [12345]) in query.conditions

    def test_key_id_filter_invalid(self):
        with pytest.raises(InvalidQuery):
            _make_query(
                "statsPeriod=4d&interval=1d&groupBy=category&key_id=INVALID&field=sum(quantity)",
                {"organization_id": 1},
            )

    def test_start_and_end_no_interval(self):
        start = timezone.now()
        end = start + timedelta(days=1)
        query = _make_query(
            f"groupBy=category&field=sum(quantity)&start={iso_format(start)}&end={iso_format(end)}",
            {"organization_id": 1},
        )
        assert query.start
        assert query.end
        assert query.rollup == 3600
