import re

from sentry.discover.arithmetic import is_equation
from sentry.discover.translation.mep_to_eap import INDEXED_EQUATIONS_PATTERN
from sentry.search.events.fields import (
    get_function_alias_with_columns,
    is_function,
    parse_arguments,
)


def strip_negative_from_orderby(orderby):
    """
    This function is used to strip the negative from an orderby item.
    """
    if orderby.startswith("-"):
        return orderby[1:], True
    return orderby, False


def _get_translated_orderby_item(orderby, columns, is_negated):
    """
    This function is used to translate the function underscore notation for orderby items
    to regular function notation. We do this by stripping both the orderby item and the given columns
    (which could be functions and fields) and then checking if it matches up to any of those stripped columns.
    """
    columns_underscore_list = []
    for column in columns:
        if (match := is_function(column)) is not None:
            aggregate, fields_string = match.group("function"), match.group("columns")
            fields = parse_arguments(aggregate, fields_string)
            columns_underscore_list.append(get_function_alias_with_columns(aggregate, fields))
        else:
            # non-function columns don't change format
            columns_underscore_list.append(column)
    joined_orderby_item = orderby
    if (match := is_function(orderby)) is not None:
        aggregate, fields_string = match.group("function"), match.group("columns")
        fields = parse_arguments(aggregate, fields_string)
        joined_orderby_item = get_function_alias_with_columns(aggregate, fields)

    converted_orderby = None
    for index, stripped_column in enumerate(columns_underscore_list):
        if joined_orderby_item == stripped_column:
            converted_orderby = columns[index]
            break

    if converted_orderby is not None:
        if is_negated:
            converted_orderby = f"-{converted_orderby}"
        return converted_orderby
    # if the orderby item is not in the columns, it should be dropped anyways
    else:
        return None


def format_orderby_for_translation(orderby, columns):
    orderby_converted_list = []
    if type(orderby) is str:
        orderby = [orderby]
    if type(orderby) is list:
        for orderby_item in orderby:
            stripped_orderby_item, is_negated = strip_negative_from_orderby(orderby_item)
            # equation orderby can be formatted in indexed format
            # (we will keep it in indexed format because the translation layer handles it)
            if re.match(INDEXED_EQUATIONS_PATTERN, stripped_orderby_item):
                orderby_converted_list.append(orderby_item)
            elif is_equation(stripped_orderby_item):
                orderby_converted_list.append(orderby_item)
            # if the orderby item is in the columns list it exists and is a field
            elif stripped_orderby_item in columns:
                orderby_converted_list.append(orderby_item)
            else:
                # orderby functions can be formated in all underscores like -count_unique_user_id for count_unique(user.id)
                # this does not apply to fields and equations
                translated_orderby_item = _get_translated_orderby_item(
                    stripped_orderby_item, columns, is_negated
                )
                if translated_orderby_item is not None:
                    orderby_converted_list.append(translated_orderby_item)
    else:
        return None

    return orderby_converted_list
