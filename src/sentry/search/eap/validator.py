from collections.abc import Callable, Iterable

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import LITERAL_OPERATOR_MAP, OPERATOR_MAP


def _expand_literal_values(values: Iterable[str]) -> frozenset[str]:
    accepted_values = set(values)
    accepted_comparison_ops = {
        LITERAL_OPERATOR_MAP[value] for value in accepted_values if value in LITERAL_OPERATOR_MAP
    }
    accepted_operator_aliases = {
        operator
        for operator, comparison_operator in OPERATOR_MAP.items()
        if comparison_operator in accepted_comparison_ops
    }

    return frozenset(accepted_values | accepted_operator_aliases)


def literal_validator(values: Iterable[str]) -> Callable[[str], bool]:
    display_values = tuple(sorted(set(values)))
    accepted_values = _expand_literal_values(display_values)

    def _validator(value: str) -> bool:
        if value in accepted_values:
            return True
        raise InvalidSearchQuery(
            f"Invalid parameter {value}. Must be one of {sorted(display_values)}"
        )

    return _validator


def number_validator(input: str) -> bool:
    if input.replace(".", "", 1).isdecimal():
        return True
    raise InvalidSearchQuery(f"Invalid parameter {input}. Must be numeric")
