"""S025's table is a copy of what ``Meta.unique_together`` says; this keeps it honest.

The flake8 plugin cannot import Django, so it carries the scoped-lookup rules as data. Every
entry must name a real model, a column that is only unique together with the required
columns (per the model's unique keys), and kwargs that exist on the model or follow one of
its relations.
"""

import importlib

import pytest
from django.apps import apps
from django.db.models import Field, Model, UniqueConstraint

from tools.flake8_plugin import S025_SCOPED_LOOKUPS

# Column names that hold another system's identifier.
EXTERNAL_COLUMN_NAMES = frozenset({"external_id", "external_identifier", "external_name"})

# Unique external-style columns S025 deliberately does not scope, and why. An entry here
# is a decision, so a column that stops existing fails the test too.
NOT_SCOPED: dict[str, str] = {
    "sentry.models.commitauthor.CommitAuthor.external_id": (
        "the value is `<provider>:<login>`, so the provider is inside the string"
    ),
    "sentry.models.project.Project.external_id": (
        "unique per organization with no provider column; the schema, not a lookup, decides"
    ),
}


def _model(path: str) -> type[Model]:
    module, name = path.rsplit(".", 1)
    model = getattr(importlib.import_module(module), name)
    assert isinstance(model, type) and issubclass(model, Model), path
    return model


def _unique_keys(model: type[Model]) -> list[frozenset[str]]:
    opts = model._meta
    keys = [frozenset(opts.get_field(name).name for name in key) for key in opts.unique_together]
    keys += [
        frozenset(opts.get_field(name).name for name in constraint.fields)
        for constraint in opts.constraints
        if isinstance(constraint, UniqueConstraint)
        and constraint.fields
        and not constraint.condition
    ]
    keys += [frozenset({f.name}) for f in opts.local_fields if f.unique]
    return keys


@pytest.mark.parametrize(
    ("path", "column", "requires"),
    [
        (path, column, requires)
        for path, columns in S025_SCOPED_LOOKUPS.items()
        for column, requires in columns.items()
    ],
)
def test_namespace_is_what_makes_the_column_unique(
    path: str, column: str, requires: dict[str, tuple[str, ...]]
) -> None:
    model = _model(path)
    namespace = frozenset(model._meta.get_field(name).name for name in (column, *requires))
    assert any(namespace <= key for key in _unique_keys(model)), (
        f"{path}.{column} + {sorted(requires)} is not part of any unique key"
    )


@pytest.mark.parametrize(
    ("path", "required", "kwarg"),
    [
        (path, required, kwarg)
        for path, columns in S025_SCOPED_LOOKUPS.items()
        for requires in columns.values()
        for required, accepted in requires.items()
        for kwarg in accepted
    ],
)
def test_accepted_kwargs_exist(path: str, required: str, kwarg: str) -> None:
    model = _model(path)
    head, _, tail = kwarg.partition("__")
    field = model._meta.get_field(head)
    if tail:
        # A path such as `idp__type` must follow a relation to a real column.
        related = field.related_model
        assert isinstance(related, type) and issubclass(related, Model), kwarg
        related._meta.get_field(tail)
    else:
        assert isinstance(field, Field)
        assert head in {field.name, field.attname}, kwarg


@pytest.mark.parametrize(
    ("required", "accepted"),
    [
        (required, accepted)
        for columns in S025_SCOPED_LOOKUPS.values()
        for requires in columns.values()
        for required, accepted in requires.items()
    ],
)
def test_required_column_is_itself_accepted(required: str, accepted: tuple[str, ...]) -> None:
    assert required in accepted


def _looks_external(column: str) -> bool:
    return column in EXTERNAL_COLUMN_NAMES or column.endswith("_external_id")


def _unique_external_columns() -> set[str]:
    found: set[str] = set()
    for model in apps.get_models():
        path = f"{model.__module__}.{model.__qualname__}"
        for key in _unique_keys(model):
            found.update(f"{path}.{column}" for column in key if _looks_external(column))
    return found


def test_every_unique_external_column_is_scoped_or_excused() -> None:
    """A new `external_id`-style column in a unique key must be a decision, not a gap."""
    scoped = {
        f"{path}.{column}" for path, columns in S025_SCOPED_LOOKUPS.items() for column in columns
    }
    unknown = _unique_external_columns() - scoped - NOT_SCOPED.keys()
    assert not unknown, (
        f"{sorted(unknown)}: add to S025_SCOPED_LOOKUPS in tools/flake8_plugin.py, or to "
        "NOT_SCOPED here with the reason it needs no provider"
    )


def test_excusals_and_rules_name_live_columns() -> None:
    live = _unique_external_columns()
    assert set(NOT_SCOPED) <= live, sorted(set(NOT_SCOPED) - live)
    assert set(NOT_SCOPED).isdisjoint(
        f"{path}.{column}" for path, columns in S025_SCOPED_LOOKUPS.items() for column in columns
    )
