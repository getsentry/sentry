import inspect
from typing import Set

from snuba_sdk import AliasedExpression, Column, Condition, Function, Granularity, Op
from snuba_sdk.query import Query

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import (
    FIELD_ALIAS_MAPPINGS,
    FILTERABLE_TAGS,
    OPERATIONS,
    DerivedMetricException,
    TransactionMRI,
)
from sentry.snuba.metrics.fields.base import DERIVED_OPS, metric_object_factory
from sentry.snuba.metrics.query import MetricConditionField, MetricField, MetricGroupByField
from sentry.snuba.metrics.query import MetricOrderByField
from sentry.snuba.metrics.query import MetricOrderByField as MetricOrderBy
from sentry.snuba.metrics.query import MetricsQuery
from sentry.snuba.metrics.query_builder import FUNCTION_ALLOWLIST

TEAM_KEY_TRANSACTION_OP = "team_key_transaction"


class MQBQueryTransformationException(Exception):
    ...


def _get_derived_op_metric_field_from_snuba_function(function: Function):
    if len(function.parameters) == 0 or not isinstance(function.parameters[0], Column):
        raise MQBQueryTransformationException(
            "The first parameter of a function should be a column of the metric MRI"
        )
    default_args_for_snql_func = {"aggregate_filter", "org_id", "alias", "use_case_id"}

    metric_field_params = {}
    function_params = function.parameters[1:]
    snql_func_args = inspect.signature(DERIVED_OPS[function.function].snql_func).parameters.keys()
    for arg in snql_func_args:
        if arg in default_args_for_snql_func:
            continue
        try:
            metric_field_params[arg] = function_params.pop(0)
        except IndexError:
            raise MQBQueryTransformationException(
                f"Too few function parameters are provided. The arguments required for function "
                f"{function.function} are "
                f"{[arg for arg in snql_func_args if arg not in default_args_for_snql_func]}"
            )

    return MetricField(
        op=function.function,
        metric_mri=function.parameters[0].name,
        params=metric_field_params,
        alias=function.alias,
    )


def _transform_select(query_select):
    select = []
    for select_field in query_select:
        if isinstance(select_field, (Column, AliasedExpression)):
            if isinstance(select_field, AliasedExpression):
                column_field = select_field.exp
                column_alias = select_field.alias
            else:
                column_field = select_field
                column_alias = None

            try:
                select.append(
                    MetricField(op=None, metric_mri=column_field.name, alias=column_alias)
                )
            except InvalidParams as e:
                raise MQBQueryTransformationException(e)
        elif isinstance(select_field, Function):
            if select_field.function in DERIVED_OPS:
                select.append(_get_derived_op_metric_field_from_snuba_function(select_field))
            else:
                if select_field.function not in OPERATIONS:
                    raise MQBQueryTransformationException(
                        f"Function '{select_field.function}' is not supported"
                    )
                if len(select_field.parameters) == 0 or not isinstance(
                    select_field.parameters[0], Column
                ):
                    raise MQBQueryTransformationException(
                        "The first parameter of a function should be a column of the metric MRI"
                    )
                select.append(
                    MetricField(
                        op=select_field.function,
                        metric_mri=select_field.parameters[0].name,
                        alias=select_field.alias,
                    )
                )
        else:
            raise MQBQueryTransformationException(f"Unsupported select field {select_field}")
    return select


def _transform_groupby(query_groupby):
    mq_groupby = []
    interval = None
    include_series = False
    for groupby_field in query_groupby:
        if isinstance(groupby_field, (Column, AliasedExpression)):
            if isinstance(groupby_field, AliasedExpression):
                column_field = groupby_field.exp
                column_alias = groupby_field.alias
            else:
                column_field = groupby_field
                column_alias = None

            if column_field.name in FIELD_ALIAS_MAPPINGS.keys() | FIELD_ALIAS_MAPPINGS.values():
                mq_groupby.append(
                    MetricGroupByField(
                        field=column_field.name,
                        alias=column_alias,
                    )
                )
            elif column_field.name.startswith("tags["):
                mq_groupby.append(
                    MetricGroupByField(
                        field=column_field.name.split("tags[")[1].split("]")[0],
                        alias=column_alias,
                    )
                )
            else:
                raise MQBQueryTransformationException(
                    f"Unsupported groupby field '{column_field.name}'"
                )
        elif isinstance(groupby_field, Function):
            if (
                groupby_field.function in DERIVED_OPS
                and DERIVED_OPS[groupby_field.function].can_groupby
            ):
                mq_groupby.append(
                    MetricGroupByField(
                        field=_get_derived_op_metric_field_from_snuba_function(groupby_field),
                        alias=groupby_field.alias,
                    )
                )
            elif groupby_field.function == "toStartOfInterval":
                # Checks against the following snuba function
                # time_groupby_column = Function(
                #    function="toStartOfInterval",
                #    parameters=[
                #        Column(name="timestamp"),
                #        Function(
                #            function="toIntervalSecond",
                #            parameters=[self._metrics_query.interval],
                #            alias=None,
                #        ),
                #        "Universal",
                #    ],
                #    alias=TS_COL_GROUP,
                # )
                include_series = True

                # Maps to `toIntervalSecond` function
                interval_func = groupby_field.parameters[1]
                assert (
                    isinstance(interval_func, Function)
                    and interval_func.function == "toIntervalSecond"
                )
                interval = interval_func.parameters[0]
                continue
            else:
                raise MQBQueryTransformationException(
                    f"Cannot group by function {groupby_field.function}"
                )
        else:
            raise MQBQueryTransformationException(f"Unsupported groupby field {groupby_field}")
    return mq_groupby if len(mq_groupby) > 0 else None, include_series, interval


def _get_mq_dict_params_from_where(query_where, is_alerts_query):
    mq_dict = {}
    where = []
    for condition in query_where:
        if not isinstance(condition, Condition):
            # Currently Boolean Condition is not supported
            raise MQBQueryTransformationException("Unsupported condition type in where clause")
        if isinstance(condition.lhs, Column):
            if condition.lhs.name == "project_id":
                mq_dict["project_ids"] = condition.rhs
            elif condition.lhs.name == "org_id":
                mq_dict["org_id"] = condition.rhs
            elif condition.lhs.name == "timestamp":
                if condition.op == Op.GTE:
                    mq_dict["start"] = condition.rhs
                elif condition.op == Op.LT:
                    mq_dict["end"] = condition.rhs
            # In case this is an alerts query, we relax restrictions.
            elif (condition.lhs.name in FILTERABLE_TAGS) or is_alerts_query:
                where.append(condition)
            else:
                raise MQBQueryTransformationException(f"Unsupported column for where {condition}")
        elif isinstance(condition.lhs, Function):
            if condition.lhs.function in DERIVED_OPS:
                if not DERIVED_OPS[condition.lhs.function].can_filter:
                    raise MQBQueryTransformationException(
                        f"Cannot filter by function {condition.lhs.function}"
                    )
                where.append(
                    MetricConditionField(
                        lhs=_get_derived_op_metric_field_from_snuba_function(condition.lhs),
                        op=condition.op,
                        rhs=condition.rhs,
                    )
                )
            elif condition.lhs.function in FUNCTION_ALLOWLIST:
                where.append(condition)
            else:
                raise MQBQueryTransformationException(
                    f"Unsupported function '{condition.lhs.function}' in where"
                )
        else:
            where.append(condition)
    mq_dict["where"] = where if len(where) > 0 else None
    return mq_dict


def _transform_orderby(query_orderby):
    mq_orderby = []
    for orderby_field in query_orderby:
        orderby_exp = orderby_field.exp

        # We want to use the string field only when a column with a valid field is passed. For example:
        # Column(name="project_id").
        if (
            isinstance(orderby_exp, Column)
            and orderby_exp.name in FIELD_ALIAS_MAPPINGS.keys() | FIELD_ALIAS_MAPPINGS.values()
        ):
            metric_order_by = MetricOrderByField(
                field=orderby_exp.name,
                direction=orderby_field.direction,
            )
        else:
            transformed_field = _transform_select([orderby_exp]).pop()
            metric_exp = metric_object_factory(
                op=transformed_field.op, metric_mri=transformed_field.metric_mri
            )
            try:
                metric_exp.validate_can_orderby()
            except DerivedMetricException as e:
                raise MQBQueryTransformationException(e)

            metric_order_by = MetricOrderBy(
                field=transformed_field, direction=orderby_field.direction
            )

        mq_orderby.append(metric_order_by)

    return mq_orderby if len(mq_orderby) > 0 else None


def _derive_mri_to_apply(project_ids, select, orderby):
    mri_dictionary = {
        "generic_metrics_distributions": TransactionMRI.DURATION.value,
        "generic_metrics_sets": TransactionMRI.USER.value,
    }
    mri_to_apply = TransactionMRI.DURATION.value

    # We first check if there is an order by field that has the team_key_transaction, otherwise
    # we just use the default mri of duration.
    has_order_by_team_key_transaction = False
    if orderby is not None:
        for orderby_field in orderby:
            if isinstance(orderby_field.field, MetricField):
                if orderby_field.field.op == TEAM_KEY_TRANSACTION_OP:
                    has_order_by_team_key_transaction = True
                    break

    if has_order_by_team_key_transaction:
        entities = set()

        if len(orderby) == 1:
            # If the number of clauses in the order by is equal to 1 and the order by has a team_key_transaction it
            # means that it must be the only one, therefore we want to infer the MRI type of the team_key_transaction
            # from one entity in the select in order to save up a query. This is just an optimization for the edge case
            # in which the select has a different entity than the default entity for the team_key_transaction, which
            # is the distribution, inferred from TransactionMRI.DURATION.
            for select_field in select:
                if select_field.op != TEAM_KEY_TRANSACTION_OP:
                    expr = metric_object_factory(select_field.op, select_field.metric_mri)
                    entity = expr.get_entity(project_ids, use_case_id=UseCaseKey.PERFORMANCE)
                    if isinstance(entity, str):
                        entities.add(entity)
        else:
            # If the number of clauses in the order by is more than 1 it means that together with team_key_transaction
            # there are other order by conditions and by definition we want all the order by conditions to belong to
            # the same entity type, therefore we want to check how many entities are there in the other order by
            # conditions and if there is only one we will infer the MRI type of the team_key_transaction
            # from that one entity. If, on the other hand, there are multiple entities, then we throw an error because
            # an order by across multiple entities is not supported.
            for orderby_field in orderby:
                if isinstance(orderby_field.field, MetricField):
                    if orderby_field.field.op != TEAM_KEY_TRANSACTION_OP:
                        expr = metric_object_factory(
                            orderby_field.field.op, orderby_field.field.metric_mri
                        )
                        entity = expr.get_entity(project_ids, use_case_id=UseCaseKey.PERFORMANCE)
                        if isinstance(entity, str):
                            entities.add(entity)

            if len(entities) > 1:
                raise InvalidParams("The orderby cannot have fields with multiple entities.")

        if len(entities) > 0:
            # Only if entities are found in the clauses we are going to update the MRI to apply, otherwise we will just
            # resort to the default one.
            mri_to_apply = mri_dictionary[entities.pop()]

    return mri_to_apply


def _transform_team_key_transaction_in_select(mri_to_apply, select):
    if select is None:
        return select

    def _select_predicate(select_field):
        if select_field.op == TEAM_KEY_TRANSACTION_OP:
            return MetricField(
                op=select_field.op,
                metric_mri=mri_to_apply,
                params=select_field.params,
                alias=select_field.alias,
            )

        return select_field

    return list(map(_select_predicate, select))


def _transform_team_key_transaction_in_where(mri_to_apply, where):
    if where is None:
        return where

    def _where_predicate(where_field):
        if (
            isinstance(where_field, MetricConditionField)
            and where_field.lhs.op == TEAM_KEY_TRANSACTION_OP
        ):
            return MetricConditionField(
                lhs=MetricField(
                    op=where_field.lhs.op,
                    metric_mri=mri_to_apply,
                    params=where_field.lhs.params,
                    alias=where_field.lhs.alias,
                ),
                op=where_field.op,
                rhs=where_field.rhs,
            )

        return where_field

    return list(map(_where_predicate, where))


def _transform_team_key_transaction_in_groupby(mri_to_apply, groupby):
    if groupby is None:
        return groupby

    def _groupby_predicate(groupby_field):
        if (
            isinstance(groupby_field.field, MetricField)
            and groupby_field.field.op == TEAM_KEY_TRANSACTION_OP
        ):
            return MetricGroupByField(
                field=MetricField(
                    op=groupby_field.field.op,
                    metric_mri=mri_to_apply,
                    params=groupby_field.field.params,
                    alias=groupby_field.field.alias,
                ),
            )

        return groupby_field

    return list(map(_groupby_predicate, groupby))


def _transform_team_key_transaction_in_orderby(mri_to_apply, orderby):
    if orderby is None:
        return orderby

    def _orderby_predicate(orderby_field):
        if isinstance(orderby_field.field, MetricField):
            if orderby_field.field.op == TEAM_KEY_TRANSACTION_OP:
                return MetricOrderByField(
                    field=MetricField(
                        op=orderby_field.field.op,
                        metric_mri=mri_to_apply,
                        params=orderby_field.field.params,
                        alias=orderby_field.field.alias,
                    ),
                    direction=orderby_field.direction,
                )

        return orderby_field

    return list(map(_orderby_predicate, orderby))


def _transform_team_key_transaction_fake_mri(mq_dict):
    mri_to_apply = _derive_mri_to_apply(
        mq_dict["project_ids"], mq_dict["select"], mq_dict["orderby"]
    )

    return {
        "select": _transform_team_key_transaction_in_select(mri_to_apply, mq_dict["select"]),
        "where": _transform_team_key_transaction_in_where(mri_to_apply, mq_dict["where"]),
        "groupby": _transform_team_key_transaction_in_groupby(mri_to_apply, mq_dict["groupby"]),
        "orderby": _transform_team_key_transaction_in_orderby(mri_to_apply, mq_dict["orderby"]),
    }


def _get_supported_entities(is_alerts_query: bool) -> Set[str]:
    supported_entities = {"generic_metrics_distributions", "generic_metrics_sets"}

    if is_alerts_query:
        supported_entities.update({"metrics_distributions", "metrics_sets"})

    return supported_entities


def transform_mqb_query_to_metrics_query(
    query: Query,
    is_alerts_query: bool = False,
) -> MetricsQuery:
    # Validate that we only support this transformation for the generic_metrics dataset
    if query.match.name not in _get_supported_entities(is_alerts_query):
        raise MQBQueryTransformationException(
            f"Unsupported entity name for {query.match.name} MQB to MetricsQuery " f"Transformation"
        )

    # Handle groupby
    groupby, include_series, interval = _transform_groupby(query.groupby)

    mq_dict = {
        "select": _transform_select(query.select),
        "groupby": groupby,
        "limit": query.limit,
        "offset": query.offset,
        "include_totals": True,
        "include_series": include_series,
        "granularity": query.granularity if query.granularity is not None else Granularity(3600),
        "orderby": _transform_orderby(query.orderby),
        "interval": interval,
        "is_alerts_query": is_alerts_query,
        "having": query.having,
        **_get_mq_dict_params_from_where(query.where, is_alerts_query),
    }

    # This code is just an edge case specific for the team_key_transaction derived operation.
    mq_dict.update(**_transform_team_key_transaction_fake_mri(mq_dict))

    return MetricsQuery(**mq_dict)
