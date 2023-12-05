import copy
from functools import partial
from unittest import mock
from unittest.mock import patch

import pytest
from snuba_sdk import Column, Direction, Function, OrderBy

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_value, resolve_weak
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics import (
    DERIVED_METRICS,
    DerivedMetricParseException,
    NotSupportedOverCompositeEntityException,
    SingularEntityDerivedMetric,
)
from sentry.snuba.metrics.fields.base import (
    COMPOSITE_ENTITY_CONSTITUENT_ALIAS,
    DERIVED_ALIASES,
    CompositeEntityDerivedMetric,
    _get_known_entity_of_metric_mri,
)
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_users,
    complement,
    crashed_sessions,
    crashed_users,
    division_float,
    errored_all_users,
    errored_preaggr_sessions,
    subtraction,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.naming_layer import (
    SessionMRI,
    SpanMRI,
    TransactionMRI,
    get_public_name_from_mri,
)
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    ret = indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)
    assert ret is not None
    return ret


perf_indexer_record = partial(indexer_record, UseCaseID.TRANSACTIONS)
rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)


def get_entity_of_metric_mocked(_, metric_mri, use_case_id):
    return {
        SessionMRI.RAW_SESSION.value: EntityKey.MetricsCounters,
        SessionMRI.RAW_USER.value: EntityKey.MetricsSets,
        SessionMRI.RAW_ERROR.value: EntityKey.MetricsSets,
        TransactionMRI.DURATION.value: EntityKey.MetricsDistributions,
        TransactionMRI.USER.value: EntityKey.MetricsSets,
        TransactionMRI.MEASUREMENTS_LCP.value: EntityKey.MetricsDistributions,
        SpanMRI.SELF_TIME.value: EntityKey.MetricsDistributions,
        SpanMRI.SELF_TIME_LIGHT.value: EntityKey.MetricsDistributions,
        SpanMRI.RESPONSE_CONTENT_LENGTH.value: EntityKey.MetricsDistributions,
        SpanMRI.DECODED_RESPONSE_CONTENT_LENGTH.value: EntityKey.MetricsDistributions,
        SpanMRI.RESPONSE_TRANSFER_SIZE.value: EntityKey.MetricsDistributions,
    }[metric_mri]


MOCKED_DERIVED_METRICS = copy.deepcopy(DERIVED_METRICS)
MOCKED_DERIVED_METRICS.update(
    {
        "crash_free_fake": SingularEntityDerivedMetric(
            metric_mri="crash_free_fake",
            metrics=[SessionMRI.CRASHED.value, SessionMRI.ERRORED_SET.value],
            unit="percentage",
            snql=lambda arg1_snql, org_id, metric_ids, alias=None: complement(
                division_float(arg1_snql, metric_ids, alias="crash_free_fake")
            ),
        ),
        "random_composite": CompositeEntityDerivedMetric(
            metric_mri="random_composite",
            metrics=[SessionMRI.ERRORED.value],
            unit="sessions",
        ),
    }
)


def mocked_mri_resolver(metric_mris, mri_func):
    return lambda x: x if x in metric_mris else mri_func(x)


@patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
class SingleEntityDerivedMetricTestCase(TestCase):
    def setUp(self):
        self.crash_free_fake = MOCKED_DERIVED_METRICS["crash_free_fake"]

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
    )
    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_public_name_from_mri",
        mocked_mri_resolver(["crash_free_fake"], get_public_name_from_mri),
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
        use_case_id = UseCaseID.SESSIONS
        expected_derived_metrics_entities = {
            SessionMRI.ALL.value: "metrics_counters",
            SessionMRI.ALL_USER.value: "metrics_sets",
            SessionMRI.CRASHED.value: "metrics_counters",
            SessionMRI.CRASHED_USER.value: "metrics_sets",
            SessionMRI.ABNORMAL.value: "metrics_counters",
            SessionMRI.ABNORMAL_USER.value: "metrics_sets",
            SessionMRI.CRASH_FREE_RATE.value: "metrics_counters",
            SessionMRI.CRASH_FREE_USER_RATE.value: "metrics_sets",
            SessionMRI.ERRORED_PREAGGREGATED.value: "metrics_counters",
            SessionMRI.ERRORED_SET.value: "metrics_sets",
            SessionMRI.ERRORED_USER_ALL.value: "metrics_sets",
            SessionMRI.CRASHED_AND_ABNORMAL_USER.value: "metrics_sets",
            SessionMRI.ERRORED_USER.value: "metrics_sets",
        }
        for key, value in expected_derived_metrics_entities.items():
            assert (
                MOCKED_DERIVED_METRICS[key].get_entity(
                    projects=[self.project], use_case_id=use_case_id
                )
            ) == value

        # Incorrectly setup SingularEntityDerivedMetric with metrics spanning multiple entities
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.get_entity(projects=[self.project], use_case_id=use_case_id)

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
    )
    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_public_name_from_mri",
        mocked_mri_resolver(["crash_free_fake"], get_public_name_from_mri),
    )
    def test_generate_select_snql_of_derived_metric(self):
        """
        Test that ensures that method generate_select_statements generates the equivalent SnQL
        required to query for the instance of DerivedMetric
        """
        org_id = self.project.organization_id
        use_case_id = UseCaseID.SESSIONS
        for status in ("init", "abnormal", "crashed", "errored"):
            rh_indexer_record(org_id, status)
        session_ids = [rh_indexer_record(org_id, SessionMRI.RAW_SESSION.value)]
        session_user_ids = [rh_indexer_record(org_id, SessionMRI.RAW_USER.value)]

        derived_name_snql = {
            SessionMRI.ALL.value: (all_sessions, session_ids),
            SessionMRI.CRASHED.value: (crashed_sessions, session_ids),
            SessionMRI.ABNORMAL.value: (abnormal_sessions, session_ids),
            SessionMRI.ERRORED_PREAGGREGATED.value: (errored_preaggr_sessions, session_ids),
            SessionMRI.ALL_USER.value: (all_users, session_user_ids),
            SessionMRI.CRASHED_USER.value: (crashed_users, session_user_ids),
            SessionMRI.ABNORMAL_USER.value: (abnormal_users, session_user_ids),
            SessionMRI.ERRORED_USER_ALL.value: (errored_all_users, session_user_ids),
        }
        for metric_mri, (func, metric_ids_list) in derived_name_snql.items():
            assert DERIVED_METRICS[metric_mri].generate_select_statements(
                [self.project],
                use_case_id=use_case_id,
                alias=metric_mri,
            ) == [
                func(
                    org_id=self.project.organization_id,
                    metric_ids=metric_ids_list,
                    alias=metric_mri,
                ),
            ]

        session_error_metric_ids = [rh_indexer_record(org_id, SessionMRI.RAW_ERROR.value)]
        assert DERIVED_METRICS[SessionMRI.ERRORED_SET.value].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias=SessionMRI.ERRORED_SET.value,
        ) == [
            uniq_aggregation_on_metric(
                metric_ids=session_error_metric_ids,
                alias=SessionMRI.ERRORED_SET.value,
            ),
        ]

        assert MOCKED_DERIVED_METRICS[
            SessionMRI.CRASHED_AND_ABNORMAL_USER.value
        ].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias="crashed_abnormal_alias",
        ) == [
            addition(
                crashed_users(org_id, session_user_ids, alias=SessionMRI.CRASHED_USER.value),
                abnormal_users(org_id, session_user_ids, alias=SessionMRI.ABNORMAL_USER.value),
                alias="crashed_abnormal_alias",
            )
        ]
        assert MOCKED_DERIVED_METRICS[SessionMRI.ERRORED_USER.value].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias="errored_user_alias",
        ) == [
            subtraction(
                errored_all_users(
                    org_id, session_user_ids, alias=SessionMRI.ERRORED_USER_ALL.value
                ),
                addition(
                    crashed_users(org_id, session_user_ids, alias=SessionMRI.CRASHED_USER.value),
                    abnormal_users(org_id, session_user_ids, alias=SessionMRI.ABNORMAL_USER.value),
                    alias=SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
                ),
                alias="errored_user_alias",
            )
        ]

        assert MOCKED_DERIVED_METRICS[SessionMRI.HEALTHY_USER.value].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias="healthy_user_alias",
        ) == [
            subtraction(
                all_users(org_id, session_user_ids, alias=SessionMRI.ALL_USER.value),
                errored_all_users(
                    org_id, session_user_ids, alias=SessionMRI.ERRORED_USER_ALL.value
                ),
                alias="healthy_user_alias",
            )
        ]

        assert MOCKED_DERIVED_METRICS[SessionMRI.CRASH_FREE_RATE.value].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias="crash_rate_alias",
        ) == [
            complement(
                division_float(
                    crashed_sessions(
                        org_id, metric_ids=session_ids, alias=SessionMRI.CRASHED.value
                    ),
                    all_sessions(org_id, metric_ids=session_ids, alias=SessionMRI.ALL.value),
                    alias="e:sessions/crash_rate@ratio",
                ),
                alias="crash_rate_alias",
            )
        ]
        assert MOCKED_DERIVED_METRICS[
            SessionMRI.CRASH_FREE_USER_RATE.value
        ].generate_select_statements(
            [self.project],
            use_case_id=use_case_id,
            alias="crash_free_rate_alias",
        ) == [
            complement(
                division_float(
                    crashed_users(
                        org_id, metric_ids=session_user_ids, alias=SessionMRI.CRASHED_USER.value
                    ),
                    all_users(org_id, metric_ids=session_user_ids, alias=SessionMRI.ALL_USER.value),
                    alias=SessionMRI.CRASH_USER_RATE.value,
                ),
                alias="crash_free_rate_alias",
            )
        ]

        # Test that ensures that even if `generate_select_statements` is called before
        # `get_entity` is called, and thereby the entity validation logic, we throw an exception
        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.generate_select_statements(
                [self.project],
                use_case_id=use_case_id,
                alias="whatever",
            )

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
    )
    @mock.patch("sentry.snuba.metrics.fields.base.org_id_from_projects", lambda _: 0)
    def test_generate_metric_ids(self):
        org_id = self.project.organization_id
        session_metric_id = rh_indexer_record(org_id, SessionMRI.RAW_SESSION.value)
        session_error_metric_id = rh_indexer_record(org_id, SessionMRI.RAW_ERROR.value)
        session_user_id = rh_indexer_record(org_id, SessionMRI.RAW_USER.value)
        use_case_id = UseCaseID.SESSIONS

        for derived_metric_mri in [
            SessionMRI.ALL.value,
            SessionMRI.CRASHED.value,
            SessionMRI.ABNORMAL.value,
            SessionMRI.CRASH_FREE_RATE.value,
            SessionMRI.ERRORED_PREAGGREGATED.value,
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_mri].generate_metric_ids(
                [], use_case_id
            ) == {session_metric_id}
        for derived_metric_mri in [
            SessionMRI.ALL_USER.value,
            SessionMRI.CRASHED_USER.value,
            SessionMRI.ABNORMAL_USER.value,
            SessionMRI.CRASH_FREE_USER_RATE.value,
            SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            SessionMRI.ERRORED_USER_ALL.value,
            SessionMRI.ERRORED_USER.value,
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_mri].generate_metric_ids(
                [], use_case_id
            ) == {session_user_id}
        assert MOCKED_DERIVED_METRICS[SessionMRI.ERRORED_SET.value].generate_metric_ids(
            [], use_case_id
        ) == {session_error_metric_id}

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
    )
    @mock.patch(
        "sentry.snuba.metrics.fields.base.get_public_name_from_mri",
        mocked_mri_resolver(["crash_free_fake"], get_public_name_from_mri),
    )
    def test_generate_order_by_clause(self):
        use_case_id = UseCaseID.SESSIONS

        for derived_metric_mri in MOCKED_DERIVED_METRICS.keys():
            if derived_metric_mri == self.crash_free_fake.metric_mri:
                continue
            derived_metric_obj = MOCKED_DERIVED_METRICS[derived_metric_mri]
            if not isinstance(derived_metric_obj, SingularEntityDerivedMetric):
                continue
            assert derived_metric_obj.generate_orderby_clause(
                projects=[self.project],
                direction=Direction.ASC,
                use_case_id=use_case_id,
                alias="test",
            ) == [
                OrderBy(
                    derived_metric_obj.generate_select_statements(
                        [self.project],
                        use_case_id=use_case_id,
                        alias="test",
                    )[0],
                    Direction.ASC,
                )
            ]

        with pytest.raises(DerivedMetricParseException):
            self.crash_free_fake.generate_orderby_clause(
                projects=[self.project],
                direction=Direction.DESC,
                use_case_id=use_case_id,
                alias="test",
            )

    def test_generate_default_value(self):
        for derived_metric_mri in [
            SessionMRI.ALL.value,
            SessionMRI.ALL_USER.value,
            SessionMRI.CRASHED.value,
            SessionMRI.CRASHED_USER.value,
            SessionMRI.ABNORMAL.value,
            SessionMRI.ABNORMAL_USER.value,
            SessionMRI.ERRORED_SET.value,
            SessionMRI.ERRORED_PREAGGREGATED.value,
            SessionMRI.ERRORED_USER.value,
            SessionMRI.ERRORED_USER_ALL.value,
            SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_mri].generate_default_null_values() == 0

        for derived_metric_mri in [
            SessionMRI.CRASH_FREE_RATE.value,
            "crash_free_fake",
            SessionMRI.CRASH_FREE_USER_RATE.value,
        ]:
            assert MOCKED_DERIVED_METRICS[derived_metric_mri].generate_default_null_values() is None

    def test_create_singular_entity_derived_metric_without_snql(self):
        """
        Test that ensures that if we try to create an instance of SingularEntityDerivedMetric
        without snql, then an exception is raised
        """
        with pytest.raises(DerivedMetricParseException):
            SingularEntityDerivedMetric(
                metric_mri=SessionMRI.ERRORED_SET.value,
                metrics=[SessionMRI.RAW_ERROR.value],
                unit="sessions",
                snql=None,
            )

    def test_run_post_query_function(self):
        totals = {
            "crashed_alias": 7,
        }
        series = {
            "crashed_alias": [4, 0, 0, 0, 3, 0],
        }
        crashed_sessions = MOCKED_DERIVED_METRICS[SessionMRI.CRASHED.value]
        assert crashed_sessions.run_post_query_function(totals, alias="crashed_alias") == 7
        assert crashed_sessions.run_post_query_function(series, alias="crashed_alias", idx=0) == 4
        assert crashed_sessions.run_post_query_function(series, alias="crashed_alias", idx=4) == 3


class CompositeEntityDerivedMetricTestCase(TestCase):
    def setUp(self):
        self.sessions_errored = MOCKED_DERIVED_METRICS[SessionMRI.ERRORED.value]

    def test_get_entity(self):
        """
        Test that ensures that the even when generating the component entities dict of instances
        of SingleEntityDerivedMetric, we are still validating that they exist
        """
        assert self.sessions_errored.get_entity(
            projects=[self.project], use_case_id=UseCaseID.SESSIONS
        ) == {
            "metrics_counters": [
                SessionMRI.ERRORED_PREAGGREGATED.value,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
            ],
            "metrics_sets": [SessionMRI.ERRORED_SET.value],
        }

    @mock.patch(
        "sentry.snuba.metrics.fields.base._get_entity_of_metric_mri", get_entity_of_metric_mocked
    )
    def test_get_entity_and_validate_dependency_tree_of_single_entity_constituents(self):
        use_case_id = UseCaseID.SESSIONS

        assert self.sessions_errored.get_entity(
            projects=[self.project], use_case_id=use_case_id
        ) == {
            "metrics_counters": [
                SessionMRI.ERRORED_PREAGGREGATED.value,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
            ],
            "metrics_sets": [SessionMRI.ERRORED_SET.value],
        }
        component_entities = DERIVED_METRICS[SessionMRI.HEALTHY.value].get_entity(
            projects=[self.project], use_case_id=use_case_id
        )

        assert isinstance(component_entities, dict)
        assert sorted(component_entities["metrics_counters"]) == [
            SessionMRI.ALL.value,
            SessionMRI.ERRORED_PREAGGREGATED.value,
        ]
        assert sorted(component_entities["metrics_sets"]) == [SessionMRI.ERRORED_SET.value]

    def test_generate_metric_ids(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_metric_ids(
                projects=[self.project], use_case_id=UseCaseID.SESSIONS
            )

    def test_generate_select_snql_of_derived_metric(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_select_statements(
                projects=[self.project],
                use_case_id=UseCaseID.SESSIONS,
                alias="test",
            )

    def test_generate_orderby_clause(self):
        with pytest.raises(NotSupportedOverCompositeEntityException):
            self.sessions_errored.generate_orderby_clause(
                direction=Direction.ASC,
                projects=[self.project],
                use_case_id=UseCaseID.SESSIONS,
                alias="test",
            )

    def test_generate_default_value(self):
        assert self.sessions_errored.generate_default_null_values() == 0

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    def test_generate_bottom_up_derived_metrics_dependencies(self):
        alias = "sessions_errored"
        assert list(
            self.sessions_errored.generate_bottom_up_derived_metrics_dependencies(alias)
        ) == [
            (
                None,
                SessionMRI.ERRORED_SET.value,
                f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.ERRORED_PREAGGREGATED.value,
                f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
                f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.ERRORED_ALL.value,
                f"{SessionMRI.ERRORED_ALL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (None, SessionMRI.ERRORED.value, alias),
        ]

        alias = "random_composite"
        assert list(
            MOCKED_DERIVED_METRICS[
                "random_composite"
            ].generate_bottom_up_derived_metrics_dependencies(alias)
        ) == [
            (
                None,
                SessionMRI.ERRORED_SET.value,
                f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.ERRORED_PREAGGREGATED.value,
                f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
                f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.ERRORED_ALL.value,
                f"{SessionMRI.ERRORED_ALL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (
                None,
                SessionMRI.ERRORED.value,
                f"{SessionMRI.ERRORED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
            ),
            (None, "random_composite", alias),
        ]

    def test_run_post_query_function(self):
        alias = "sessions_errored"
        totals = {
            f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": 3,
            f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": 4.0,
            f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": 0,
            f"{SessionMRI.ERRORED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": 0,
            f"{SessionMRI.ERRORED_ALL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": 7,
        }
        series = {
            f"{SessionMRI.ERRORED_SET.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": [
                0,
                0,
                0,
                0,
                3,
                0,
            ],
            f"{SessionMRI.ERRORED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": [
                0,
                0,
                0,
                0,
                0,
                0,
            ],
            f"{SessionMRI.ERRORED_PREAGGREGATED.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": [
                4.0,
                0,
                0,
                0,
                0,
                0,
            ],
            f"{SessionMRI.CRASHED_AND_ABNORMAL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": [
                0,
                0,
                0,
                0,
                0,
                0,
            ],
            f"{SessionMRI.ERRORED_ALL.value}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}": [
                4.0,
                0,
                0,
                0,
                3,
                0,
            ],
        }
        assert (
            self.sessions_errored.run_post_query_function(
                totals,
                alias=alias,
            )
            == 7
        )
        assert self.sessions_errored.run_post_query_function(series, alias=alias, idx=0) == 4
        assert self.sessions_errored.run_post_query_function(series, alias=alias, idx=4) == 3


class DerivedMetricAliasTestCase(TestCase):
    def test_session_duration_derived_alias(self):
        org_id = self.project.organization_id
        use_case_id = UseCaseID.SESSIONS
        session_duration_derived_alias = DERIVED_ALIASES[SessionMRI.DURATION.value]
        assert session_duration_derived_alias.generate_filter_snql_conditions(
            org_id, use_case_id
        ) == Function(
            "and",
            [
                Function(
                    "equals",
                    [
                        Column("metric_id"),
                        resolve_weak(use_case_id, org_id, SessionMRI.RAW_DURATION.value),
                    ],
                ),
                Function(
                    "equals",
                    (
                        Column(f"tags[{resolve_weak(use_case_id, org_id, 'session.status')}]"),
                        resolve_tag_value(use_case_id, org_id, "exited"),
                    ),
                ),
            ],
        )


@pytest.mark.parametrize(
    "metric_mri,expected_entity",
    [
        ("c:sessions/session@none", EntityKey.MetricsCounters),
        ("s:sessions/user@none", EntityKey.MetricsSets),
        ("d:sessions/duration@second", EntityKey.MetricsDistributions),
        ("d:sessions/unknown_metric@second", None),
        ("e:sessions/all@none", None),  # derived metric
        ("", None),
        ("foo", None),
        ("foo:foo:foo", None),
    ],
)
def test_known_entity_of_metric_mri(metric_mri, expected_entity):
    assert _get_known_entity_of_metric_mri(metric_mri) == expected_entity
