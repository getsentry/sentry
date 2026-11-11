from datetime import timedelta

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from sentry.discover.arithmetic import ArithmeticError, parse_arithmetic, strip_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.incidents.logic import EAP_FUNCTIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.fields import is_function
from sentry.search.events.types import SnubaParams


def validate_spans_equation_aggregate(aggregate: str) -> None:
    equation = strip_equation(aggregate)
    try:
        _operation, fields, functions = parse_arithmetic(equation, definitions=SPAN_DEFINITIONS)
    except ArithmeticError as e:
        raise serializers.ValidationError({"aggregate": _(f"Invalid Metric: {e}")})

    # The subscription only sends aggregate expressions to Snuba, so an equation without
    # functions would produce an empty request.
    if fields or not functions:
        raise serializers.ValidationError(
            {
                "aggregate": _(
                    "Invalid Metric: An equation must combine aggregate functions, such as "
                    "sum(a) / sum(b)."
                )
            }
        )

    for function in functions:
        match = is_function(function)
        if match is None or match.group("function") not in EAP_FUNCTIONS:
            raise serializers.ValidationError(
                {"aggregate": _(f"Invalid Metric: {function} is not supported in monitors.")}
            )

    now = timezone.now()
    resolver = SearchResolver(
        params=SnubaParams(projects=[], organization=None, start=now - timedelta(hours=1), end=now),
        config=SearchResolverConfig(),
        definitions=SPAN_DEFINITIONS,
    )
    try:
        resolver.resolve_equation(equation)
    except (InvalidSearchQuery, ArithmeticError) as e:
        raise serializers.ValidationError({"aggregate": _(f"Invalid Metric: {e}")})
