from __future__ import absolute_import

import six

from sentry.utils.snuba import Dataset, aliased_query, get_snuba_column_name, get_function_index

# TODO(mark) Once this import is removed, transform_results should not
# be exported.
from sentry import eventstore
from sentry.snuba.discover import transform_results


def parse_columns_in_functions(col, context=None, index=None):
    """
    Checks expressions for arguments that should be considered a column while
    ignoring strings that represent clickhouse function names

    if col is a list, means the expression has functions and we need
    to parse for arguments that should be considered column names.

    Assumptions here:
     * strings that represent clickhouse function names are always followed by a list or tuple
     * strings that are quoted with single quotes are used as string literals for CH
     * otherwise we should attempt to get the snuba column name (or custom tag)
    """

    function_name_index = get_function_index(col)

    if function_name_index is not None:
        # if this is non zero, that means there are strings before this index
        # that should be converted to snuba column names
        # e.g. ['func1', ['column', 'func2', ['arg1']]]
        if function_name_index > 0:
            for i in six.moves.xrange(0, function_name_index):
                if context is not None:
                    context[i] = get_snuba_column_name(col[i])

        args = col[function_name_index + 1]

        # check for nested functions in args
        if get_function_index(args):
            # look for columns
            return parse_columns_in_functions(args, args)

        # check each argument for column names
        else:
            for (i, arg) in enumerate(args):
                parse_columns_in_functions(arg, args, i)
    else:
        # probably a column name
        if context is not None and index is not None:
            context[index] = get_snuba_column_name(col)


def transform_aliases_and_query(**kwargs):
    """
    Convert aliases in selected_columns, groupby, aggregation, conditions,
    orderby and arrayjoin fields to their internal Snuba format and post the
    query to Snuba. Convert back translated aliases before returning snuba
    results.

    :deprecated: This method is deprecated. You should use sentry.snuba.discover instead.
    """

    arrayjoin_map = {"error": "exception_stacks", "stack": "exception_frames"}

    translated_columns = {}
    derived_columns = set()

    selected_columns = kwargs.get("selected_columns")
    groupby = kwargs.get("groupby")
    aggregations = kwargs.get("aggregations")
    conditions = kwargs.get("conditions")
    filter_keys = kwargs["filter_keys"]
    arrayjoin = kwargs.get("arrayjoin")
    orderby = kwargs.get("orderby")
    having = kwargs.get("having", [])
    dataset = Dataset.Events

    if selected_columns:
        for (idx, col) in enumerate(selected_columns):
            if isinstance(col, list):
                # if list, means there are potentially nested functions and need to
                # iterate and translate potential columns
                parse_columns_in_functions(col)
                selected_columns[idx] = col
                translated_columns[col[2]] = col[2]
                derived_columns.add(col[2])
            else:
                name = get_snuba_column_name(col)
                selected_columns[idx] = name
                translated_columns[name] = col

    if groupby:
        for (idx, col) in enumerate(groupby):
            if col not in derived_columns:
                name = get_snuba_column_name(col)
            else:
                name = col

            groupby[idx] = name
            translated_columns[name] = col

    for aggregation in aggregations or []:
        derived_columns.add(aggregation[2])
        if isinstance(aggregation[1], six.string_types):
            aggregation[1] = get_snuba_column_name(aggregation[1])
        elif isinstance(aggregation[1], (set, tuple, list)):
            aggregation[1] = [get_snuba_column_name(col) for col in aggregation[1]]

    for col in list(filter_keys.keys()):
        name = get_snuba_column_name(col)
        filter_keys[name] = filter_keys.pop(col)

    if conditions:
        aliased_conditions = []
        for condition in conditions:
            field = condition[0]
            if not isinstance(field, (list, tuple)) and field in derived_columns:
                having.append(condition)
            else:
                aliased_conditions.append(condition)
        kwargs["conditions"] = aliased_conditions

    if having:
        kwargs["having"] = having

    if orderby:
        orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
        translated_orderby = []

        for field_with_order in orderby:
            field = field_with_order.lstrip("-")
            translated_orderby.append(
                u"{}{}".format(
                    "-" if field_with_order.startswith("-") else "",
                    field if field in derived_columns else get_snuba_column_name(field),
                )
            )

        kwargs["orderby"] = translated_orderby

    kwargs["arrayjoin"] = arrayjoin_map.get(arrayjoin, arrayjoin)
    kwargs["dataset"] = dataset

    result = aliased_query(**kwargs)

    snuba_filter = eventstore.Filter(
        rollup=kwargs.get("rollup"),
        start=kwargs.get("start"),
        end=kwargs.get("end"),
        orderby=kwargs.get("orderby"),
    )
    return transform_results(result, translated_columns, snuba_filter)
