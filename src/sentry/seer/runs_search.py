from __future__ import annotations

from collections.abc import Sequence

from django.db.models import Q, QuerySet

from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    QueryToken,
    SearchConfig,
    SearchFilter,
    parse_search_query,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.seer.models.run import SeerRun, SeerRunType

search_config = SearchConfig.create_from(
    SearchConfig(),
    # Keys we allow text operators (e.g. ``~``) to be used on.
    text_operator_keys={"source", "type"},
    # ``is:agent`` / ``!is:agent`` selects runs that do (or do not) have a
    # SeerAgentRun row. ``is:mine`` / ``!is:mine`` selects runs owned (or not
    # owned) by the requesting user.
    boolean_keys={"agent", "mine"},
    is_filter_translation={
        "agent": ("agent", True),
        "mine": ("mine", True),
    },
    allowed_keys={
        "agent",
        "has",
        "is",
        "mine",
        "project",
        "source",
        "type",
    },
    free_text_key="text",
)

# Search keys that don't map 1:1 to a ``SeerRun`` field name.
FIELD_MAPPINGS: dict[str, str] = {
    "source": "agent__source",
}

_SEER_RUN_TYPES = frozenset(member.value for member in SeerRunType)


def _validate_type(value: object) -> str:
    raw = str(value)
    if raw not in _SEER_RUN_TYPES:
        raise InvalidSearchQuery(
            f"Invalid type value: {value}. Valid values: {', '.join(sorted(_SEER_RUN_TYPES))}"
        )
    return raw


def _validate_project_id(value: object) -> int:
    # ``project`` maps to the integer ``agent__project_id`` column. Validate up
    # front so a non-numeric value raises InvalidSearchQuery (a 400) rather than
    # a ValueError during lazy SQL compilation (a 500).
    raw = str(value)
    if not raw.isdigit():
        raise InvalidSearchQuery(f"Invalid project value: {value}. Expected a numeric project ID.")
    return int(raw)


def queryset_for_query(
    query: str, organization: Organization, user_id: int | None
) -> QuerySet[SeerRun]:
    """
    Build a ``SeerRun`` queryset for ``organization`` filtered by ``query``.

    All runs for the organization are listed by default; ``is:agent`` /
    ``!is:agent`` opts in/out of runs that have a ``SeerAgentRun`` row, and
    ``is:mine`` / ``!is:mine`` opts in/out of runs owned by ``user_id``.

    Raises:
        InvalidSearchQuery: if the query string is invalid.
    """
    search_filters = parse_search_query(query, config=search_config)
    queryset = SeerRun.objects.filter(organization=organization)
    return apply_filters(queryset, search_filters, user_id)


def apply_filters(
    queryset: QuerySet[SeerRun],
    filters: Sequence[QueryToken],
    user_id: int | None,
) -> QuerySet[SeerRun]:
    for token in filters:
        if isinstance(token, str):  # "AND" / "OR" literals
            raise InvalidSearchQuery(f"Boolean operators are not supported: {token}")
        if isinstance(token, ParenExpression):
            raise InvalidSearchQuery("Parenthetical expressions are not supported")
        if isinstance(token, AggregateFilter):
            raise InvalidSearchQuery("Aggregate filters are not supported")

        assert isinstance(token, SearchFilter)

        name = token.key.name

        if name == "text":
            search_term = str(token.value.value).strip()
            if not search_term:
                continue
            queryset = queryset.filter(agent__title__icontains=search_term)
            continue

        if name == "agent":
            # ``is:agent`` / ``has:agent`` select runs that have a SeerAgentRun
            # row; the negated forms select runs without one. ``is_negation``
            # normalizes the differing ``is:`` (``=``/``!=``) and ``has:``
            # (``!=``/``=``) operator conventions into a single flag.
            queryset = queryset.filter(agent__isnull=token.is_negation)
            continue

        if name == "mine":
            # ``is:mine`` selects runs owned by the requesting user; ``!is:mine``
            # selects everyone else's. An anonymous actor (no user_id) can never
            # own a run. ``has:``/``!has:`` map onto the same semantics.
            want_mine = not token.is_negation
            if user_id is None:
                queryset = queryset.none() if want_mine else queryset
            elif want_mine:
                queryset = queryset.filter(user_id=user_id)
            else:
                queryset = queryset.exclude(user_id=user_id)
            continue

        if name == "type":
            values = token.value.value if token.is_in_filter else [token.value.value]
            q = Q(type__in=[_validate_type(v) for v in values])
            queryset = queryset.exclude(q) if token.is_negation else queryset.filter(q)
            continue

        if name == "project":
            if token.is_in_filter or token.value.value != "":
                values = token.value.value if token.is_in_filter else [token.value.value]
                q = Q(agent__project_id__in=[_validate_project_id(v) for v in values])
            else:
                # ``has:project`` / ``!has:project`` — filter on whether a
                # project is set rather than parsing the (empty) value as an ID.
                q = Q(agent__project_id__isnull=False)
            queryset = queryset.exclude(q) if token.is_negation else queryset.filter(q)
            continue

        db_field = FIELD_MAPPINGS.get(name, name)
        is_has_filter = token.operator in ("=", "!=") and token.value.value == ""

        if token.value.is_wildcard():
            # Check wildcard before the IN branch: a bracketed list containing a
            # wildcard (e.g. ``source:[foo*, bar*]``) collapses ``value`` into a
            # single combined regex string, not a list, so it must use __regex.
            # Passing that string to __in would make Django iterate its chars.
            q = Q(**{f"{db_field}__regex": token.value.value})
        elif token.is_in_filter:
            q = Q(**{f"{db_field}__in": token.value.value})
        elif token.operator == "~":
            q = Q(**{f"{db_field}__icontains": token.value.value})
        elif is_has_filter:
            # has: / !has: filter
            q = Q(**{f"{db_field}__isnull": False})
        elif token.operator in ("=", "!="):
            q = Q(**{f"{db_field}__exact": token.value.value})
        else:
            raise InvalidSearchQuery(f"Unsupported operator {token.operator} for {name}.")

        if token.is_negation or token.operator == "!~":
            q = ~q
            if not is_has_filter:
                # A negated match across the nullable ``agent`` join would
                # otherwise also return rows where the field is NULL (e.g. runs
                # with no SeerAgentRun row). Standard Sentry search excludes
                # NULLs from negated filters; ``!has:`` selects them explicitly.
                q &= Q(**{f"{db_field}__isnull": False})
        queryset = queryset.filter(q)

    return queryset.distinct()
