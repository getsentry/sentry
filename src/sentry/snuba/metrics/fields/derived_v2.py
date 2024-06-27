"""
This is a copy of derived.py from src/sentry/snuba/metrics/fields/derived.py with a few differences

Why create a copy of derived.py?
The snql function factories used for the DERIVED_METRICS and DERIVED_OPS are different between the
old and new metrics data model.
"""

# ToDo(ahmed): Investigate dealing with derived metric keys as Enum objects rather than string
#  values
from collections.abc import Mapping

from sentry.search.events.constants import MISERY_ALPHA, MISERY_BETA
from sentry.snuba.metrics.fields.base import (
    AliasedDerivedMetric,
    CompositeEntityDerivedMetric,
    DerivedOp,
    SingularEntityDerivedMetric,
)
from sentry.snuba.metrics.fields.histogram import rebucket_histogram
from sentry.snuba.metrics.fields.snql_v2 import (
    abnormal_sessions_v2,
    abnormal_users_v2,
    addition,
    all_duration_transactions_v2,
    all_sessions_v2,
    all_spans_v2,
    all_transactions_v2,
    all_users_v2,
    anr_users_v2,
    apdex_v2,
    complement,
    count_transaction_name_snql_factory_v2,
    count_web_vitals_snql_factory_v2,
    crashed_sessions_v2,
    crashed_users_v2,
    division_float,
    errored_all_users_v2,
    errored_preaggr_sessions_v2,
    failure_count_transaction_v2,
    foreground_anr_users_v2,
    histogram_snql_factory_v2,
    http_error_count_span_v2,
    http_error_count_transaction_v2,
    max_timestamp_v2,
    min_timestamp_v2,
    miserable_users_v2,
    on_demand_apdex_snql_factory_v2,
    on_demand_count_unique_snql_factory_v2,
    on_demand_count_web_vitals_snql_factory_v2,
    on_demand_epm_snql_factory_v2,
    on_demand_eps_snql_factory_v2,
    on_demand_failure_count_snql_factory_v2,
    on_demand_failure_rate_snql_factory_v2,
    on_demand_user_misery_snql_factory_v2,
    rate_snql_factory_v2,
    satisfaction_count_transaction_v2,
    session_duration_filters_v2,
    subtraction,
    sum_if_column_snql_v2,
    team_key_transaction_snql_v2,
    tolerated_count_transaction_v2,
    uniq_aggregation_on_metric_v2,
    uniq_if_column_snql_v2,
)
from sentry.snuba.metrics.naming_layer import SessionMRI
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.snuba.metrics.utils import MetricOperationType

DERIVED_METRICS = {
    derived_metric.metric_mri: derived_metric
    for derived_metric in [
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_sessions_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: abnormal_sessions_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: abnormal_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: crashed_sessions_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: crashed_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ANR_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: anr_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.FOREGROUND_ANR_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: foreground_anr_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_RATE.value,
            metrics=[SessionMRI.CRASHED.value, SessionMRI.ALL.value],
            unit="percentage",
            snql=lambda crashed_count, all_count, project_ids, org_id, metric_ids, alias=None: division_float(
                crashed_count, all_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_USER_RATE.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda crashed_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                crashed_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ANR_RATE.value,
            metrics=[
                SessionMRI.ANR_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda anr_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                anr_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.FOREGROUND_ANR_RATE.value,
            metrics=[
                SessionMRI.FOREGROUND_ANR_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda foreground_anr_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                foreground_anr_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_RATE.value,
            metrics=[SessionMRI.CRASH_RATE.value],
            unit="percentage",
            snql=lambda crash_rate_value, project_ids, org_id, metric_ids, alias=None: complement(
                crash_rate_value, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE.value,
            metrics=[SessionMRI.ALL.value, SessionMRI.CRASHED.value],
            unit="sessions",
            snql=lambda all_count, crashed_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_count, crashed_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value,
            metrics=[SessionMRI.CRASH_USER_RATE.value],
            unit="percentage",
            snql=lambda crash_user_rate_value, project_ids, org_id, metric_ids, alias=None: complement(
                crash_user_rate_value, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_USER.value,
            metrics=[
                SessionMRI.ALL_USER.value,
                SessionMRI.CRASHED_USER.value,
            ],
            unit="users",
            snql=lambda all_user_count, crashed_user_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_user_count, crashed_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_PREAGGREGATED.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: errored_preaggr_sessions_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_SET.value,
            metrics=[SessionMRI.RAW_ERROR.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: uniq_aggregation_on_metric_v2(
                metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL.value,
            metrics=[
                SessionMRI.CRASHED.value,
                SessionMRI.ABNORMAL.value,
            ],
            unit="sessions",
            snql=lambda crashed_count, abnormal_count, project_ids, org_id, metric_ids, alias=None: addition(
                crashed_count, abnormal_count, alias=alias
            ),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_ALL.value,
            metrics=[
                SessionMRI.ERRORED_PREAGGREGATED.value,
                SessionMRI.ERRORED_SET.value,
            ],
            unit="sessions",
            post_query_func=lambda *args: sum([*args]),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED.value,
            metrics=[
                SessionMRI.ERRORED_ALL.value,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
            ],
            unit="sessions",
            post_query_func=lambda errored_all, crashed_abnormal: max(
                0, errored_all - crashed_abnormal
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_USER_ALL.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: errored_all_users_v2(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda crashed_user_count, abnormal_user_count, project_ids, org_id, metric_ids, alias=None: addition(
                crashed_user_count, abnormal_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_USER.value,
            metrics=[
                SessionMRI.ERRORED_USER_ALL.value,
                SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda errored_user_all_count, crashed_and_abnormal_user_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                errored_user_all_count, crashed_and_abnormal_user_count, alias=alias
            ),
            post_query_func=lambda *args: max(0, *args),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.HEALTHY.value,
            metrics=[
                SessionMRI.ALL.value,
                SessionMRI.ERRORED_ALL.value,
            ],
            unit="sessions",
            post_query_func=lambda init, errored: max(0, init - errored),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.HEALTHY_USER.value,
            metrics=[
                SessionMRI.ALL_USER.value,
                SessionMRI.ERRORED_USER_ALL.value,
            ],
            unit="users",
            snql=lambda all_user_count, errored_user_all_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_user_count, errored_user_all_count, alias=alias
            ),
            post_query_func=lambda *args: max(0, *args),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_transactions_v2(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL_DURATION.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_duration_transactions_v2(
                metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_COUNT.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: failure_count_transaction_v2(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_RATE.value,
            metrics=[
                TransactionMRI.FAILURE_COUNT.value,
                TransactionMRI.ALL_DURATION.value,
            ],
            unit="transactions",
            snql=lambda failure_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                failure_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.HTTP_ERROR_COUNT.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_transaction_v2(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.HTTP_ERROR_RATE.value,
            metrics=[
                TransactionMRI.HTTP_ERROR_COUNT.value,
                TransactionMRI.ALL_DURATION.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.ALL.value,
            metrics=[SpanMRI.SELF_TIME.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_spans_v2(
                metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.ALL_LIGHT.value,
            metrics=[SpanMRI.SELF_TIME_LIGHT.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_spans_v2(
                metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_COUNT.value,
            metrics=[SpanMRI.SELF_TIME.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_span_v2(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_RATE.value,
            metrics=[
                SpanMRI.HTTP_ERROR_COUNT.value,
                SpanMRI.ALL.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_COUNT_LIGHT.value,
            metrics=[SpanMRI.SELF_TIME_LIGHT.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_span_v2(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_RATE_LIGHT.value,
            metrics=[
                SpanMRI.HTTP_ERROR_COUNT_LIGHT.value,
                SpanMRI.ALL_LIGHT.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.SATISFIED.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: satisfaction_count_transaction_v2(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.TOLERATED.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: tolerated_count_transaction_v2(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.apdex.value,
            metrics=[
                TransactionMRI.SATISFIED.value,
                TransactionMRI.TOLERATED.value,
                TransactionMRI.ALL.value,
            ],
            unit="percentage",
            snql=lambda satisfied, tolerated, total, project_ids, org_id, metric_ids, alias=None: apdex_v2(
                satisfied, tolerated, total, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.MISERABLE_USER.value,
            metrics=[
                TransactionMRI.USER.value,
            ],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: miserable_users_v2(
                org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL_USER.value,
            metrics=[TransactionMRI.USER.value],
            unit="percentage",
            snql=lambda project_ids, org_id, metric_ids, alias=None: uniq_aggregation_on_metric_v2(
                metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.USER_MISERY.value,
            metrics=[TransactionMRI.MISERABLE_USER.value, TransactionMRI.ALL_USER.value],
            unit="percentage",
            snql=lambda miserable_user, user, project_ids, org_id, metric_ids, alias=None: division_float(
                addition(miserable_user, MISERY_ALPHA),
                addition(user, MISERY_ALPHA + MISERY_BETA),
                alias,
            ),
        ),
    ]
}

DERIVED_OPS: Mapping[MetricOperationType, DerivedOp] = {
    derived_op.op: derived_op
    for derived_op in [
        DerivedOp(
            op="histogram",
            can_orderby=False,
            post_query_func=rebucket_histogram,
            snql_func=histogram_snql_factory_v2,
            default_null_value=[],
        ),
        DerivedOp(
            op="rate",
            can_orderby=True,
            snql_func=rate_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="count_web_vitals",
            can_orderby=True,
            snql_func=count_web_vitals_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="count_transaction_name",
            can_orderby=True,
            snql_func=count_transaction_name_snql_factory_v2,
            default_null_value=0,
        ),
        # This specific derived operation doesn't require a metric_mri supplied to the MetricField but
        # in order to avoid breaking the contract we should always pass it. When using it in the orderby
        # clause you should put a metric mri with the same entity as the only entity used in the select.
        # E.g. if you have a select with user_misery which is a set entity and team_key_transaction and you want
        # to order by team_key_transaction, you will have to supply to the team_key_transaction MetricField
        # an mri that has the set entity.
        #
        # OrderBy(
        #     field=MetricField(
        #         op="team_key_transaction",
        #         # This has entity type set, which is the entity type of the select (in the select you can only have
        #         one entity type across selections if you use the team_key_transaction in the order by).
        #         metric_mri=TransactionMRI.USER.value,
        #         params={
        #             "team_key_condition_rhs": [
        #                 (self.project.id, "foo_transaction"),
        #             ]
        #         },
        #         alias="team_key_transactions",
        #     ),
        #     direction=Direction.DESC,
        # )
        DerivedOp(
            op="team_key_transaction",
            can_orderby=True,
            can_groupby=True,
            can_filter=True,
            snql_func=team_key_transaction_snql_v2,
            default_null_value=0,
            meta_type="boolean",
        ),
        DerivedOp(
            op="sum_if_column",
            can_orderby=True,
            snql_func=sum_if_column_snql_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="uniq_if_column",
            can_orderby=True,
            snql_func=uniq_if_column_snql_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="min_timestamp",
            can_groupby=True,
            can_orderby=True,
            can_filter=True,
            snql_func=min_timestamp_v2,
            meta_type="datetime",
            default_null_value=None,
        ),
        DerivedOp(
            op="max_timestamp",
            can_groupby=True,
            can_orderby=True,
            can_filter=True,
            snql_func=max_timestamp_v2,
            meta_type="datetime",
            default_null_value=None,
        ),
        # Custom operations used for on demand derived metrics.
        DerivedOp(
            op="on_demand_apdex",
            can_orderby=True,
            snql_func=on_demand_apdex_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_epm",
            can_orderby=True,
            snql_func=on_demand_epm_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_eps",
            can_orderby=True,
            snql_func=on_demand_eps_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_failure_count",
            can_orderby=True,
            snql_func=on_demand_failure_count_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_failure_rate",
            can_orderby=True,
            snql_func=on_demand_failure_rate_snql_factory_v2,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_count_unique",
            can_orderby=True,
            snql_func=on_demand_count_unique_snql_factory_v2,
        ),
        DerivedOp(
            op="on_demand_count_web_vitals",
            can_orderby=True,
            snql_func=on_demand_count_web_vitals_snql_factory_v2,
        ),
        DerivedOp(
            op="on_demand_user_misery",
            can_orderby=True,
            snql_func=on_demand_user_misery_snql_factory_v2,
            default_null_value=0,
        ),
    ]
}

DERIVED_ALIASES: Mapping[str, AliasedDerivedMetric] = {
    derived_alias.metric_mri: derived_alias
    for derived_alias in [
        AliasedDerivedMetric(
            metric_mri=SessionMRI.DURATION.value,
            raw_metric_mri=SessionMRI.RAW_DURATION.value,
            filters=lambda *_, org_id: session_duration_filters_v2(org_id),
        )
    ]
}
