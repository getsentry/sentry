from unittest import mock

import pytest
from snuba_sdk import Direction, OrderBy

from sentry.sentry_metrics import indexer
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    DerivedMetricParseException,
    SingularEntityDerivedMetric,
)
from sentry.snuba.metrics.fields.snql import (
    crashed_sessions,
    errored_preaggr_sessions,
    init_sessions,
    percentage,
    sessions_errored_set,
)
from sentry.testutils import TestCase


def get_single_metric_info_mocked(_, metric_name):
    return {
        "type": {
            "sentry.sessions.session": "counter",
            "sentry.sessions.session.error": "set",
        }[metric_name]
    }


class SingleEntityDerivedMetricTestCase(TestCase):
    def setUp(self):
        self.crash_free_fake = SingularEntityDerivedMetric(
            metric_name="crash_free_fake",
            metrics=["session.crashed", "session.errored_set"],
            unit="percentage",
            snql=lambda *args, metric_ids, alias=None: percentage(
                *args, metric_ids, alias="crash_free_fake"
            ),
        )
        DERIVED_METRICS.update({"crash_free_fake": self.crash_free_fake})

    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_single_metric_info", get_single_metric_info_mocked
    )
    def test_get_entity_and_validate_dependency_tree_of_a_single_entity_derived_metric(self):
        """
        Tests that ensures that get_entity method works expected in the sense that:
        - Since it is the first function that is called by the query_builder, validation is
        applied there to ensure that if it is an instance of a SingleEntityDerivedMetric,
        then it is composed of only other SingleEntityDerivedMetric or
        RawMetric that belong to the same entity
        - Return the entity of that derived metric
        """
        expected_derived_metrics_entities = {
            "session.init": "metrics_counters",
            "session.crashed": "metrics_counters",
            "session.crash_free_rate": "metrics_counters",
            "session.errored_preaggregated": "metrics_counters",
            "session.errored_set": "metrics_sets",
        }
        for key, value in expected_derived_metrics_entities.items():
            assert (DERIVED_METRICS[key].get_entity(projects=[self.project])) == value

        # Incorrectly setup SingularEntityDerivedMetric with metrics spanning multiple entities
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.get_entity(projects=[self.project])

    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_single_metric_info", get_single_metric_info_mocked
    )
    def test_generate_select_snql_of_derived_metric(self):
        """
        Test that ensures that method generate_select_statements generates the equivalent SnQL
        required to query for the instance of DerivedMetric
        """
        for status in ("init", "crashed"):
            indexer.record(status)
        session_ids = [indexer.record("sentry.sessions.session")]

        derived_name_snql = {
            "session.init": (init_sessions, session_ids),
            "session.crashed": (crashed_sessions, session_ids),
            "session.errored_preaggregated": (errored_preaggr_sessions, session_ids),
            "session.errored_set": (
                sessions_errored_set,
                [indexer.record("sentry.sessions.session.error")],
            ),
        }
        for metric_name, (func, metric_ids_list) in derived_name_snql.items():
            assert DERIVED_METRICS[metric_name].generate_select_statements([self.project]) == [
                func(metric_ids=metric_ids_list, alias=metric_name),
            ]

        assert DERIVED_METRICS["session.crash_free_rate"].generate_select_statements(
            [self.project]
        ) == [
            percentage(
                crashed_sessions(metric_ids=session_ids, alias="session.crashed"),
                init_sessions(metric_ids=session_ids, alias="session.init"),
                alias="session.crash_free_rate",
            )
        ]

        # Test that ensures that even if `generate_select_statements` is called before
        # `get_entity` is called, and thereby the entity validation logic, we throw an exception
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.generate_select_statements([self.project])

    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_single_metric_info", get_single_metric_info_mocked
    )
    def test_generate_metric_ids(self):
        session_metric_id = indexer.record("sentry.sessions.session")
        session_error_metric_id = indexer.record("sentry.sessions.session.error")

        for derived_metric_name in [
            "session.init",
            "session.crashed",
            "session.crash_free_rate",
            "session.errored_preaggregated",
        ]:
            assert DERIVED_METRICS[derived_metric_name].generate_metric_ids() == {session_metric_id}
        assert DERIVED_METRICS["session.errored_set"].generate_metric_ids() == {
            session_error_metric_id
        }

    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_single_metric_info", get_single_metric_info_mocked
    )
    def test_generate_order_by_clause(self):
        for derived_metric_name in DERIVED_METRICS.keys():
            if derived_metric_name == self.crash_free_fake.metric_name:
                continue
            derived_metric_obj = DERIVED_METRICS[derived_metric_name]
            assert derived_metric_obj.generate_orderby_clause(
                projects=[self.project], direction=Direction.ASC
            ) == [
                OrderBy(
                    derived_metric_obj.generate_select_statements([self.project])[0], Direction.ASC
                )
            ]

        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.generate_orderby_clause(
                projects=[self.project], direction=Direction.DESC
            )

    def test_generate_default_value(self):
        for derived_metric_name in [
            "session.init",
            "session.crashed",
            "session.errored_set",
            "session.errored_preaggregated",
        ]:
            assert DERIVED_METRICS[derived_metric_name].generate_default_null_values() == 0

        for derived_metric_name in ["session.crash_free_rate", "crash_free_fake"]:
            assert DERIVED_METRICS[derived_metric_name].generate_default_null_values() is None
