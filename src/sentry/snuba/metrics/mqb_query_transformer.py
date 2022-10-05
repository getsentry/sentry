import inspect

from snuba_sdk import AliasedExpression, Column, Function, Granularity, Op
from snuba_sdk.query import Query

from sentry.snuba.metrics import FIELD_ALIAS_MAPPINGS
from sentry.snuba.metrics.fields.base import DERIVED_OPS
from sentry.snuba.metrics.query import (
    MetricConditionField,
    MetricField,
    MetricGroupByField,
    MetricsQuery,
)
from sentry.snuba.metrics.query import OrderBy as MetricOrderBy


class MQBQueryTransformationException(Exception):
    ...


def _get_derived_op_metric_field_from_snuba_function(function: Function):
    if len(function.parameters) == 0 or not isinstance(function.parameters[0], Column):
        raise MQBQueryTransformationException(
            "The first parameter of a function should be a column of the metric MRI"
        )

    metric_field_params = {}
    function_params = function.parameters[1:]
    snql_func_args = inspect.signature(DERIVED_OPS[function.function].snql_func).parameters.keys()
    for arg in snql_func_args:
        if arg in {"aggregate_filter", "org_id", "alias"}:
            continue
        try:
            metric_field_params[arg] = function_params.pop(0)
        except IndexError:
            raise MQBQueryTransformationException(
                f"Too few function parameters are provided. The arguments provided for function "
                f"{function.function} are "
                f"{[arg for arg in snql_func_args if arg not in {'org_id', 'aggregate_filter', 'alias'}]}"
            )

    return MetricField(
        op=function.function,
        metric_mri=function.parameters[0].name,
        params=metric_field_params,
        alias=function.alias,
    )


def _transform_select(query_select):
    select = []
    groupby = []
    for select_field in query_select:
        if isinstance(select_field, Column):
            if select_field.name.startswith("tags["):
                groupby.append(select_field)

            select.append(
                MetricField(
                    op=None,
                    metric_mri=select_field.name,
                )
            )
        elif isinstance(select_field, AliasedExpression):
            if select_field.exp.name.startswith("tags["):
                groupby.append(select_field)

            select.append(
                MetricField(
                    op=None,
                    metric_mri=select_field.exp.name,
                    alias=select_field.alias,
                )
            )
        elif isinstance(select_field, Function):
            if select_field.function in DERIVED_OPS:
                select.append(_get_derived_op_metric_field_from_snuba_function(select_field))
            else:
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
    return select, groupby


def _transform_groupby(query_groupby):
    mq_groupby = []
    include_series = False
    for groupby_field in query_groupby:
        if isinstance(groupby_field, Column):
            if groupby_field.name == "bucketed_time":
                include_series = True
                continue
            if groupby_field.name in FIELD_ALIAS_MAPPINGS.keys() | FIELD_ALIAS_MAPPINGS.values():
                mq_groupby.append(
                    MetricGroupByField(
                        field=groupby_field.name,
                    )
                )
            elif groupby_field.name.startswith("tags["):
                mq_groupby.append(
                    MetricGroupByField(
                        field=groupby_field.name.split("tags[")[1].split("]")[0],
                    )
                )
            else:
                raise MQBQueryTransformationException(f"Unsupported groupby field {groupby_field}")

        elif isinstance(groupby_field, AliasedExpression):
            if groupby_field.exp.name == "bucketed_time":
                include_series = True
                continue
            if (
                groupby_field.exp.name
                in FIELD_ALIAS_MAPPINGS.keys() | FIELD_ALIAS_MAPPINGS.values()
            ):
                mq_groupby.append(
                    MetricGroupByField(
                        field=groupby_field.exp.name,
                        alias=groupby_field.alias,
                    )
                )
            elif groupby_field.exp.name.startswith("tags["):
                mq_groupby.append(
                    MetricGroupByField(
                        field=groupby_field.exp.name.split("tags[")[1].split("]")[0],
                        alias=groupby_field.alias,
                    )
                )
            else:
                raise MQBQueryTransformationException(f"Unsupported groupby field {groupby_field}")
        elif isinstance(groupby_field, Function):
            if groupby_field.function not in DERIVED_OPS:
                raise MQBQueryTransformationException(
                    f"Unsupported function {groupby_field.function}"
                )

            if not DERIVED_OPS[groupby_field.function].can_groupby:
                raise MQBQueryTransformationException(
                    f"Cannot group by function {groupby_field.function}"
                )

            mq_groupby.append(
                MetricGroupByField(
                    field=_get_derived_op_metric_field_from_snuba_function(groupby_field),
                    alias=groupby_field.alias,
                )
            )
        else:
            raise MQBQueryTransformationException(f"Unsupported groupby field {groupby_field}")
    return mq_groupby, include_series


def _get_mq_dict_params_from_where(query_where):
    mq_dict = {}
    where = []
    for condition in query_where:
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
        elif isinstance(condition.lhs, Function) and condition.lhs.function in DERIVED_OPS:
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
        else:
            where.append(condition)
    mq_dict["where"] = where
    return mq_dict


def _transform_orderby(query_orderby):
    mq_orderby = []
    for orderby_field in query_orderby:
        transformed_field_lst, _ = _transform_select([orderby_field.exp])
        transformed_field = transformed_field_lst.pop()
        # ToDo(ahmed): Implement validate_can_orderby
        # metric_exp = metric_object_factory(
        #     op=transformed_field.op, metric_mri=transformed_field.metric_mri
        # )
        mq_orderby.append(MetricOrderBy(field=transformed_field, direction=orderby_field.direction))
    return mq_orderby


def tranform_mqb_query_to_metrics_query(query: Query) -> MetricsQuery:
    # Handles select statements
    select, extra_groupby = _transform_select(query.select)
    # Handle groupby
    groupby, include_series = _transform_groupby(query.groupby + extra_groupby)
    # Handle orderby
    orderby = _transform_orderby(query.orderby)

    mq_dict = {
        "select": select,
        "groupby": groupby,
        "limit": query.limit,
        "offset": query.offset,
        "include_totals": True,
        "include_series": include_series,
        "granularity": query.granularity if query.granularity is not None else Granularity(3600),
        "orderby": orderby,
        **_get_mq_dict_params_from_where(query.where),
    }
    return MetricsQuery(**mq_dict)
