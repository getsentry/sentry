import inspect

from snuba_sdk import AliasedExpression, Column, Condition, Function, Granularity, Op
from snuba_sdk.query import Query

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics import FIELD_ALIAS_MAPPINGS, OPERATIONS, DerivedMetricException
from sentry.snuba.metrics.fields.base import DERIVED_OPS, metric_object_factory
from sentry.snuba.metrics.query import (
    MetricConditionField,
    MetricField,
    MetricGroupByField,
    MetricsQuery,
)
from sentry.snuba.metrics.query import OrderBy as MetricOrderBy
from sentry.snuba.metrics.query_builder import FUNCTION_ALLOWLIST


class MQBQueryTransformationException(Exception):
    ...


def _get_derived_op_metric_field_from_snuba_function(function: Function):
    if len(function.parameters) == 0 or not isinstance(function.parameters[0], Column):
        raise MQBQueryTransformationException(
            "The first parameter of a function should be a column of the metric MRI"
        )
    default_args_for_snql_func = {"aggregate_filter", "org_id", "alias"}

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


def _get_mq_dict_params_from_where(query_where):
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
            elif condition.lhs.name == "tags[environment]":
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
        transformed_field = _transform_select([orderby_field.exp]).pop()
        metric_exp = metric_object_factory(
            op=transformed_field.op, metric_mri=transformed_field.metric_mri
        )
        try:
            metric_exp.validate_can_orderby()
        except DerivedMetricException as e:
            raise MQBQueryTransformationException(e)
        mq_orderby.append(MetricOrderBy(field=transformed_field, direction=orderby_field.direction))
    return mq_orderby if len(mq_orderby) > 0 else None


def tranform_mqb_query_to_metrics_query(query: Query) -> MetricsQuery:
    # Validate that we only support this transformation for the generic_metrics dataset
    if query.match.name not in {"generic_metrics_distributions", "generic_metrics_sets"}:
        raise MQBQueryTransformationException(
            f"Unsupported entity name for {query.match.name} MQB to MetricsQuery " f"Transformation"
        )

    if query.having:
        raise MQBQueryTransformationException(
            "Having clauses are not supported by the metrics layer"
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
        **_get_mq_dict_params_from_where(query.where),
    }
    return MetricsQuery(**mq_dict)
