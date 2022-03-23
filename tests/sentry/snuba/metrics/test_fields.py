import copy
from unittest import mock
from unittest.mock import patch

import pytest
from snuba_sdk import Direction, OrderBy

from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    NotSupportedOverCompositeEntityException,
    SingularEntityDerivedMetric,
)
from sentry.snuba.metrics.fields.base import CompositeEntityDerivedMetric
from sentry.snuba.metrics.fields.snql import (
    all_sessions,
    crashed_sessions,
    errored_preaggr_sessions,
    percentage,
    sessions_errored_set,
)
from sentry.testutils import TestCase


def get_entity_of_metric_mocked(_, metric_name):
    return {
        "sentry.sessions.session": EntityKey.MetricsCounters,
        "sentry.sessions.session.error": EntityKey.MetricsSets,
    }[metric_name]


MOCKED_DERIVED_METRICS = copy.deepcopy(DERIVED_METRICS)
MOCKED_DERIVED_METRICS.update(
    {
        "crash_free_fake": SingularEntityDerivedMetric(
            metric_name="crash_free_fake",
            metrics=["session.crashed", "session.errored_set"],
            unit="percentage",
            snql=lambda *args, entity, metric_ids, alias=None: percentage(
                *args, entity, metric_ids, alias="crash_free_fake"
            ),
        ),
        "random_composite": CompositeEntityDerivedMetric(
            metric_name="random_composite",
            metrics=["session.errored"],
            unit="sessions",
        ),
    }
)


@patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
class SingleEntityDerivedMetricTestCase(TestCase):
    def setUp(self):
        self.crash_free_fake = MOCKED_DERIVED_METRICS["crash_free_fake"]

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
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
            "session.all": "metrics_counters",
            "session.crashed": "metrics_counters",
            "session.crash_free_rate": "metrics_counters",
            "session.errored_preaggregated": "metrics_counters",
            "session.errored_set": "metrics_sets",
        }
        for key, value in expected_derived_metrics_entities.items():
            assert (MOCKED_DERIVED_METRICS[key].get_entity(projects=[self.project])) == value

        # Incorrectly setup SingularEntityDerivedMetric with metrics spanning multiple entities
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.get_entity(projects=[self.project])

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
    )
    def test_generate_select_snql_of_derived_metric(self):
        """
        Test that ensures that method generate_select_statements generates the equivalent SnQL
        required to query for the instance of DerivedMetric
        """
        org_id = self.project.organization_id
        for status in ("init", "crashed"):
            indexer.record(org_id, status)
        session_ids = [indexer.record(org_id, "sentry.sessions.session")]

        derived_name_snql = {
            "session.all": (all_sessions, session_ids),
            "session.crashed": (crashed_sessions, session_ids),
            "session.errored_preaggregated": (errored_preaggr_sessions, session_ids),
            "session.errored_set": (
                sessions_errored_set,
                [indexer.record(org_id, "sentry.sessions.session.error")],
            ),
        }
        for metric_name, (func, metric_ids_list) in derived_name_snql.items():
            assert DERIVED_METRICS[metric_name].generate_select_statements([self.project]) == [
                func(metric_ids=metric_ids_list, alias=metric_name),
            ]

        assert MOCKED_DERIVED_METRICS["session.crash_free_rate"].generate_select_statements(
            [self.project]
        ) == [
            percentage(
                crashed_sessions(metric_ids=session_ids, alias="session.crashed"),
                all_sessions(metric_ids=session_ids, alias="session.all"),
                alias="session.crash_free_rate",
            )
        ]

        # Test that ensures that even if `generate_select_statements` is called before
        # `get_entity` is called, and thereby the entity validation logic, we throw an exception
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.generate_select_statements([self.project])

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
    )
    def test_generate_metric_ids(self):
        org_id = self.project.organization_id
        session_metric_id = indexer.record(org_id, "sentry.sessions.session")
        session_error_metric_id = indexer.record(org_id, "sentry.sessions.session.error")

        for derived_metric_name in [
            "session.all",
            "session.crashed",
            "session.crash_free_rate",
            "session.errored_preaggregated",
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_name].generate_metric_ids() == {
                session_metric_id
            }
        assert MOCKED_DERIVED_METRICS["session.errored_set"].generate_metric_ids() == {
            session_error_metric_id
        }

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
    )
    def test_generate_order_by_clause(self):
        for derived_metric_name in MOCKED_DERIVED_METRICS.keys():
            if derived_metric_name == self.crash_free_fake.metric_name:
                continue
            derived_metric_obj = MOCKED_DERIVED_METRICS[derived_metric_name]
            if not isinstance(derived_metric_obj, SingularEntityDerivedMetric):
                continue
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
            "session.all",
            "session.crashed",
            "session.errored_set",
            "session.errored_preaggregated",
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_name].generate_default_null_values() == 0

        for derived_metric_name in ["session.crash_free_rate", "crash_free_fake"]:
            assert (
                MOCKED_DERIVED_METRICS[derived_metric_name].generate_default_null_values() is None
            )

    def test_create_singular_entity_derived_metric_without_snql(self):
        """
        Test that ensures that if we try to create an instance of SingularEntityDerivedMetric
        without snql, then an exception is raised
        """
        with pytest.raises(DerivedMetricParseException):
            SingularEntityDerivedMetric(
                metric_name="session.errored_set",
                metrics=["sentry.sessions.session.error"],
                unit="sessions",
                snql=None,
            )

    def test_run_post_query_function(self):
        totals = {
            "session.crashed": 7,
        }
        series = {
            "session.crashed": [4, 0, 0, 0, 3, 0],
        }
        crashed_sessions = MOCKED_DERIVED_METRICS["session.crashed"]
        assert crashed_sessions.run_post_query_function(totals) == 7
        assert crashed_sessions.run_post_query_function(series, idx=0) == 4
        assert crashed_sessions.run_post_query_function(series, idx=4) == 3


class CompositeEntityDerivedMetricTestCase(TestCase):
    def setUp(self):
        self.sessions_errored = MOCKED_DERIVED_METRICS["session.errored"]

    def test_get_entity(self):
        """
        Test that ensures that the even when generating the component entities dict of instances
        of SingleEntityDerivedMetric, we are still validating that they exist
        """
        with pytest.raises(MetricDoesNotExistException):
            assert self.sessions_errored.get_entity(projects=[1]) == {
                "metrics_counters": ["session.errored_preaggregated"],
                "metrics_sets": ["session.errored_set"],
            }

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_name", get_entity_of_metric_mocked
    )
    def test_get_entity_and_validate_dependency_tree_of_single_entity_constituents(self):
        assert self.sessions_errored.get_entity(projects=[1]) == {
            "metrics_counters": ["session.errored_preaggregated"],
            "metrics_sets": ["session.errored_set"],
        }

    def test_generate_metric_ids(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_metric_ids()

    def test_generate_select_snql_of_derived_metric(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_select_statements(projects=[1])

    def test_generate_orderby_clause(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_orderby_clause(direction=Direction.ASC, projects=[1])

    def test_generate_default_value(self):
        assert self.sessions_errored.generate_default_null_values() == 0

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    def test_generate_bottom_up_derived_metrics_dependencies(self):
        assert list(self.sessions_errored.generate_bottom_up_derived_metrics_dependencies()) == [
            (None, "session.errored_set"),
            (None, "session.errored_preaggregated"),
            (None, "session.errored"),
        ]

        assert list(
            MOCKED_DERIVED_METRICS[
                "random_composite"
            ].generate_bottom_up_derived_metrics_dependencies()
        ) == [
            (None, "session.errored_set"),
            (None, "session.errored_preaggregated"),
            (None, "session.errored"),
            (None, "random_composite"),
        ]

    def test_run_post_query_function(self):
        totals = {
            "session.errored_set": 3,
            "session.errored_preaggregated": 4.0,
            "session.errored": 0,
        }
        series = {
            "session.errored_set": [0, 0, 0, 0, 3, 0],
            "session.errored": [0, 0, 0, 0, 0, 0],
            "session.errored_preaggregated": [4.0, 0, 0, 0, 0, 0],
        }
        assert self.sessions_errored.run_post_query_function(totals) == 7
        assert self.sessions_errored.run_post_query_function(series, idx=0) == 4
        assert self.sessions_errored.run_post_query_function(series, idx=4) == 3
