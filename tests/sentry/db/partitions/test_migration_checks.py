from datetime import timedelta
from typing import Any

from django.apps import apps
from django.db import models
from django.db.migrations import CreateModel
from django.db.migrations.loader import MigrationLoader
from django.test import override_settings
from django.test.utils import isolate_apps

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning
from sentry.db.partitions.migration_checks import (
    CreatedModel,
    get_partitioning_migration_errors,
    iter_created_models,
)
from sentry.new_migrations.operations import CreatePartitionedModel

WEEKLY = RangePartitioning("date_added", PartitionInterval.WEEK)
MIGRATED = {"fixtures"}


def test_declarations_match_migrations() -> None:
    # Tests run with migrations disabled.
    with override_settings(MIGRATION_MODULES={}):
        loader = MigrationLoader(None, ignore_no_migrations=True)
    created = list(iter_created_models(loader))
    assert len(created) > 100
    assert get_partitioning_migration_errors(created, apps.get_models(), loader.migrated_apps) == []


def created(name: str, partitioning: RangePartitioning | HashPartitioning | None) -> CreatedModel:
    fields: list[tuple[str, models.Field[Any, Any]]] = [
        ("id", models.BigAutoField(primary_key=True))
    ]
    operation = (
        CreateModel(name, fields)
        if partitioning is None
        else CreatePartitionedModel(name, fields, partitioning=partitioning)
    )
    return CreatedModel("fixtures", "0001_initial", operation)


@isolate_apps("fixtures")
def test_mismatches() -> None:
    class Declared(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = WEEKLY

        date_added = models.DateTimeField()

        class Meta:
            app_label = "fixtures"

    class Plain(Model):
        __relocation_scope__ = RelocationScope.Excluded

        class Meta:
            app_label = "fixtures"

    # Created as declared. Maintenance settings may change later.
    assert (
        get_partitioning_migration_errors(
            [
                created(
                    "Declared",
                    RangePartitioning("date_added", PartitionInterval.WEEK, premake=8),
                ),
                created("Plain", None),
            ],
            [Declared, Plain],
            MIGRATED,
        )
        == []
    )

    assert get_partitioning_migration_errors([created("Declared", None)], [Declared], MIGRATED) == [
        "fixtures.Declared declares `__partitioning__`, but its table is created by a plain "
        "CreateModel in fixtures.0001_initial. Only new models can be partitioned, with "
        "CreatePartitionedModel. Declaring partitioning doesn't convert an existing table."
    ]
    assert get_partitioning_migration_errors([created("Plain", WEEKLY)], [Plain], MIGRATED) == [
        "fixtures.Plain is created by CreatePartitionedModel in fixtures.0001_initial, but "
        "doesn't declare `__partitioning__`."
    ]
    daily = RangePartitioning("date_added", PartitionInterval.DAY, retention=timedelta(days=7))
    assert get_partitioning_migration_errors(
        [created("Declared", daily)], [Declared], MIGRATED
    ) == [
        f"fixtures.Declared declares {WEEKLY}, but fixtures.0001_initial created its table "
        f"with {daily}. How a table is partitioned can't change."
    ]

    # Declared, but nothing creates it, e.g. after a RenameModel.
    assert get_partitioning_migration_errors([], [Declared, Plain], MIGRATED) == [
        "fixtures.Declared declares `__partitioning__`, but no migration creates it, e.g. "
        "because it was renamed. Only models created with CreatePartitionedModel can be "
        "partitioned."
    ]
    # Apps without migrations only get tables from their models.
    assert get_partitioning_migration_errors([], [Declared, Plain], set()) == []
