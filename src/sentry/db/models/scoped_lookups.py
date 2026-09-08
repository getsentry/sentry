"""Guard lookups by a namespaced key against omitting the namespace.

Columns such as ``Repository.external_id`` or ``Integration.external_id`` hold identifiers
minted by another system, so they are only unique together with the column naming that
system (``provider``); ``Meta.unique_together`` records the full key. A query that filters on
the identifier alone spans every namespace and, when two providers mint the same id, silently
returns the wrong row — or raises ``MultipleObjectsReturned`` from a ``.get()``.

A model opts in with ``__scoped_lookups__``. Every terminal queryset operation then inspects
the resolved ``WHERE`` clause, so chained filters, ``Q`` objects, dict-built filters and joins
are all covered: each enrolled column present must be accompanied by its namespace columns —
directly, through a declared substitute, through a joined table pinned by its own unique key,
or by the primary key. Like ``ModelSiloLimit``, a violation raises in tests and counts a
metric in production. ``QuerySet.unscoped_lookup(reason=...)`` opts a deliberate
cross-namespace query out.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from types import FrameType
from typing import Any, cast

from django.db.models import Model, UniqueConstraint
from django.db.models.expressions import Col
from django.db.models.fields import Field
from django.db.models.lookups import IsNull, Lookup
from django.db.models.sql.datastructures import Join
from django.db.models.sql.query import Query
from django.db.models.sql.where import OR, WhereNode

logger = logging.getLogger(__name__)

# A column the WHERE clause constrains: (table alias, field name).
ColumnRef = tuple[str, str]


@dataclass(frozen=True)
class ScopedLookup:
    """Declare that a column is only meaningful together with its namespace columns.

    ``requires`` names the namespace: columns that must accompany this one in every lookup.
    Together with the column they must be part of a unique key on the model — that is the
    invariant being protected, and :func:`scoped_lookups` rejects a declaration that isn't.
    ``substitutes`` maps a required column to alternatives that pin it: another column on the
    same model (``integration_id`` pins ``provider``) or a ``fk__column`` path onto a joined
    model (``idp__type``).
    """

    requires: tuple[str, ...]
    substitutes: Mapping[str, tuple[str, ...]] = field(default_factory=dict)


@dataclass(frozen=True)
class Violation:
    model: type[Model]
    column: str
    rule: ScopedLookup

    def __str__(self) -> str:
        requires = ", ".join(self.rule.requires)
        return (
            f"{self.model.__name__}.{self.column} is only unique together with {requires}; "
            f"filter on {requires} too, or use .unscoped_lookup(reason=...) for a deliberate "
            "cross-namespace query"
        )


class ScopedLookupError(Exception):
    """A query filtered on a scoped column without its namespace."""


_rules_cache: dict[type[Model], dict[str, ScopedLookup]] = {}


def scoped_lookups(model: type[Model]) -> dict[str, ScopedLookup]:
    """The model's validated ``__scoped_lookups__`` declaration; ``{}`` when not enrolled."""
    try:
        return _rules_cache[model]
    except KeyError:
        pass
    declared: Mapping[str, ScopedLookup] = getattr(model, "__scoped_lookups__", {})
    rules = {column: _validated(model, column, rule) for column, rule in declared.items()}
    _rules_cache[model] = rules
    return rules


def unique_keys(model: type[Model]) -> list[frozenset[str]]:
    """Every set of field names the model declares unique, including the primary key."""
    opts = model._meta
    keys = [frozenset(_field_name(model, name) for name in key) for key in opts.unique_together]
    keys += [
        frozenset(_field_name(model, name) for name in constraint.fields)
        for constraint in opts.constraints
        if isinstance(constraint, UniqueConstraint)
        and constraint.fields
        and not constraint.condition
    ]
    keys += [frozenset({f.name}) for f in opts.local_fields if f.unique]
    return keys


def _field_name(model: type[Model], name: str) -> str:
    # ``unique_together`` may spell a foreign key by its attname (``idp_id``).
    return model._meta.get_field(name).name


def _validated(model: type[Model], column: str, rule: ScopedLookup) -> ScopedLookup:
    label = f"{model.__name__}.__scoped_lookups__[{column!r}]"
    if not rule.requires:
        raise TypeError(f"{label} must require at least one namespace column")
    namespace = frozenset(_field_name(model, name) for name in (column, *rule.requires))
    if not any(namespace <= key for key in unique_keys(model)):
        raise TypeError(
            f"{label}: {sorted(namespace)} is not part of any unique key; the namespace must be "
            "what makes the column unique"
        )
    for required, substitutes in rule.substitutes.items():
        if required not in rule.requires:
            raise TypeError(f"{label} substitutes {required!r}, which it does not require")
        for substitute in substitutes:
            head, _, tail = substitute.partition("__")
            if tail:
                related = model._meta.get_field(head).related_model
                if not (isinstance(related, type) and issubclass(related, Model)):
                    raise TypeError(
                        f"{label}: substitute {substitute!r} does not follow a relation"
                    )
                related._meta.get_field(tail)
            else:
                model._meta.get_field(head)
    return rule


def check_query(query: Query) -> list[Violation]:
    """Every scoped column ``query`` looks up without its namespace, in encounter order."""
    violations: list[Violation] = []
    for subquery in _direct_subqueries(query.where):
        violations += check_query(subquery)
    if query.combinator:
        for combined in query.combined_queries:
            violations += check_query(combined)
        return violations

    models_by_alias = _models_by_alias(query)
    if not any(scoped_lookups(model) for model in models_by_alias.values()):
        return violations

    context = _Context(query, models_by_alias)
    pinned = _pinned_foreign_keys(context, _guaranteed(query.where))
    _check_node(query.where, frozenset(pinned), context)
    return violations + context.violations


def enforce(query: Query) -> None:
    """Raise on a violating query in tests; count and log it once per process in production.

    Queries a test itself builds are left alone: a fixture with one provider makes an
    unscoped assertion harmless, and the guard is for production code paths.
    """
    violations = check_query(query)
    if not violations:
        return

    from sentry.utils.env import in_test_environment

    origin = _origin()
    if in_test_environment() and not _is_test_path(origin[0] if origin else ""):
        raise ScopedLookupError("; ".join(str(v) for v in violations))

    from sentry.utils import metrics

    for violation in violations:
        metrics.incr(
            "db.scoped_lookup.violation",
            tags={"model": violation.model._meta.label_lower, "column": violation.column},
            sample_rate=1.0,
        )
        key = (violation.model, violation.column)
        if key not in _reported:
            _reported.add(key)
            logger.warning(
                "db.scoped_lookup.violation",
                extra={
                    "model": violation.model._meta.label_lower,
                    "column": violation.column,
                    "origin": f"{origin[0]}:{origin[1]}" if origin else None,
                },
            )


_reported: set[tuple[type[Model], str]] = set()

_TEST_PATH_MARKERS = ("/tests/", "/testutils/", "/fixtures/", "/_pytest/", "/pluggy/")


def _plumbing_dirs() -> tuple[str, ...]:
    """Packages whose frames sit between a query's author and its execution."""
    import django

    import sentry.silo

    return (
        os.path.dirname(django.__file__),
        os.path.dirname(os.path.dirname(__file__)),  # sentry.db.models: managers and this guard
        os.path.dirname(sentry.silo.__file__),  # ModelSiloLimit wraps every manager method
    )


def _origin() -> tuple[str, int] | None:
    """File and line of the nearest frame outside the plumbing: where the query was evaluated."""
    plumbing = _plumbing_dirs()
    frame: FrameType | None = sys._getframe(1)
    while frame is not None:
        filename = frame.f_code.co_filename
        if not filename.startswith(plumbing):
            return filename, frame.f_lineno
        frame = frame.f_back
    return None


def _is_test_path(filename: str) -> bool:
    return any(marker in filename for marker in _TEST_PATH_MARKERS)


@dataclass
class _Context:
    query: Query
    models_by_alias: Mapping[str, type[Model]]
    violations: list[Violation] = field(default_factory=list)


def _models_by_alias(query: Query) -> dict[str, type[Model]]:
    model = query.model
    assert model is not None, "a compiled query always has a model"
    return {
        alias: _joined_model(table) if isinstance(table, Join) else model
        for alias, table in query.alias_map.items()
    }


def _joined_model(table: Join) -> type[Model]:
    # A forward join carries the FK field, a reverse one its rel; both know the joined model.
    related = cast(Any, table.join_field).related_model
    assert isinstance(related, type), "joins are resolved against concrete models"
    return related


def _direct_subqueries(where: WhereNode) -> Iterator[Query]:
    """Subqueries referenced directly by the top-level clause, e.g. ``pk__in=<queryset>``."""
    for child in where.children:
        if isinstance(child, Lookup) and isinstance(child.rhs, Query):
            yield child.rhs
            continue
        query = getattr(child, "query", None)
        if isinstance(query, Query):
            yield query


def _column(lookup: Lookup[Any]) -> ColumnRef | None:
    lhs: Any = lookup.lhs
    # Unwrap transforms (``name__lower__exact``) down to the column they apply to.
    while not isinstance(lhs, Col):
        lhs = getattr(lhs, "lhs", None)
        if lhs is None:
            return None
    return (lhs.alias, lhs.target.name)


def _leaf(child: Any, *, lookups_only: bool = False) -> frozenset[ColumnRef]:
    """Columns a single WHERE child constrains.

    ``col = NULL`` (``IsNull`` with a true rhs) constrains the column to one value like any
    other equality, so it counts towards a namespace; ``IS NOT NULL`` constrains nothing.
    Neither is a *lookup* of a row by that column, which is what ``lookups_only`` asks for.
    """
    if not isinstance(child, Lookup):
        return frozenset()
    if isinstance(child, IsNull) and (lookups_only or not child.rhs):
        return frozenset()
    ref = _column(child)
    return frozenset({ref}) if ref is not None else frozenset()


def _guaranteed(node: WhereNode) -> frozenset[ColumnRef]:
    """Columns every row matching ``node`` is constrained on.

    A conjunction guarantees the union of its parts, a disjunction only what every branch
    constrains (``Q(provider="github") | Q(provider="integrations:github")`` still pins
    ``provider``), and a negation guarantees nothing.
    """
    if node.negated or not node.children:
        return frozenset()
    parts = [
        _guaranteed(child) if isinstance(child, WhereNode) else _leaf(child)
        for child in node.children
    ]
    if node.connector == OR:
        return frozenset.intersection(*parts)
    return frozenset.union(*parts)


def _check_node(node: WhereNode, inherited: frozenset[ColumnRef], context: _Context) -> None:
    """Check each lookup in ``node`` against what its enclosing conjunctions guarantee."""
    if node.negated:
        return
    if node.connector == OR:
        for child in node.children:
            if isinstance(child, WhereNode):
                _check_node(child, inherited, context)
            else:
                _check_refs(_leaf(child, lookups_only=True), inherited | _leaf(child), context)
        return

    nested = [child for child in node.children if isinstance(child, WhereNode)]
    leaves = [child for child in node.children if not isinstance(child, WhereNode)]
    lookups = frozenset().union(*(_leaf(child, lookups_only=True) for child in leaves))
    present = inherited.union(*(_leaf(child) for child in leaves))
    for child in nested:
        present |= _guaranteed(child)
    _check_refs(lookups, present, context)
    for child in nested:
        _check_node(child, present, context)


def _check_refs(refs: frozenset[ColumnRef], present: frozenset[ColumnRef], ctx: _Context) -> None:
    for alias, column in refs:
        model = ctx.models_by_alias.get(alias)
        if model is None:
            continue
        rule = scoped_lookups(model).get(column)
        if rule is not None and not _satisfied(alias, model, rule, present, ctx):
            ctx.violations.append(Violation(model, column, rule))


def _satisfied(
    alias: str, model: type[Model], rule: ScopedLookup, present: frozenset[ColumnRef], ctx: _Context
) -> bool:
    if (alias, model._meta.pk.name) in present:
        return True
    return all(
        (alias, required) in present
        or any(
            _substitute_present(alias, substitute, present, ctx)
            for substitute in rule.substitutes.get(required, ())
        )
        for required in rule.requires
    )


def _substitute_present(
    alias: str, substitute: str, present: frozenset[ColumnRef], ctx: _Context
) -> bool:
    head, _, tail = substitute.partition("__")
    if not tail:
        return (alias, head) in present
    joined = _forward_join(ctx.query, alias, head)
    return joined is not None and (joined.table_alias, tail) in present


def _forward_join(query: Query, parent_alias: str, fk_name: str) -> Join | None:
    for table in query.alias_map.values():
        if (
            isinstance(table, Join)
            and table.parent_alias == parent_alias
            and isinstance(table.join_field, Field)
            and table.join_field.name == fk_name
        ):
            return table
    return None


def _pinned_foreign_keys(context: _Context, guaranteed: frozenset[ColumnRef]) -> set[ColumnRef]:
    """Foreign keys pinned because the joined row is constrained on one of its unique keys.

    ``Identity.objects.filter(external_id=..., idp__type=..., idp__external_id=...)`` names no
    ``idp_id``, yet the join fixes exactly one identity provider.
    """
    pinned: set[ColumnRef] = set()
    for alias, table in context.query.alias_map.items():
        if not isinstance(table, Join) or not isinstance(table.join_field, Field):
            continue
        joined_columns = {column for a, column in guaranteed if a == alias}
        joined_model = context.models_by_alias[alias]
        if any(key <= joined_columns for key in unique_keys(joined_model)):
            pinned.add((table.parent_alias, table.join_field.name))
    return pinned
