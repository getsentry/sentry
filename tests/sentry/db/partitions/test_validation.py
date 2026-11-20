from datetime import timedelta

import pytest
from django.contrib.postgres.constraints import ExclusionConstraint
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.db.models import F
from django.test.utils import isolate_apps

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning
from sentry.db.partitions.validation import (
    get_model_partitioning_errors,
    get_relation_errors,
    validate_all_models,
)

WEEKLY = RangePartitioning("date_added", PartitionInterval.WEEK)


@isolate_apps("fixtures")
def test_valid_range_partitioned_model() -> None:
    class Valid(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = WEEKLY

        date_added = models.DateTimeField()
        name = models.CharField(max_length=10)

        class Meta:
            app_label = "fixtures"
            unique_together = (("name", "date_added"),)
            constraints = [
                models.UniqueConstraint(fields=["id", "date_added"], name="valid_id_date_uniq")
            ]

    assert get_model_partitioning_errors(Valid) == []


@isolate_apps("fixtures")
def test_valid_hash_partitioned_model_on_foreign_key() -> None:
    class Parent(Model):
        __relocation_scope__ = RelocationScope.Excluded

        class Meta:
            app_label = "fixtures"

    class Valid(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = HashPartitioning("parent", modulus=8)

        parent = FlexibleForeignKey(Parent)

        class Meta:
            app_label = "fixtures"

    assert get_model_partitioning_errors(Valid) == []


@isolate_apps("fixtures")
def test_models_without_partitioning_are_not_checked() -> None:
    class Plain(Model):
        __relocation_scope__ = RelocationScope.Excluded

        name = models.CharField(max_length=10, unique=True)

        class Meta:
            app_label = "fixtures"

    assert get_model_partitioning_errors(Plain) == []


@isolate_apps("fixtures")
def test_invalid_declaration_raises_when_the_class_is_defined() -> None:
    with pytest.raises(ImproperlyConfigured, match="partition field `missing` does not exist"):

        class Invalid(Model):
            __relocation_scope__ = RelocationScope.Excluded
            __partitioning__ = RangePartitioning("missing", PartitionInterval.DAY)

            class Meta:
                app_label = "fixtures"


@isolate_apps("fixtures")
def test_partition_field_rules() -> None:
    class Fields(Model):
        __relocation_scope__ = RelocationScope.Excluded

        date_added = models.DateTimeField()
        nullable_date = models.DateTimeField(null=True)
        name = models.CharField(max_length=10)

        class Meta:
            app_label = "fixtures"

    def errors(spec: RangePartitioning | HashPartitioning) -> list[str]:
        return get_model_partitioning_errors(Fields, spec)

    assert errors(RangePartitioning("nullable_date", PartitionInterval.DAY)) == [
        "The partition field `nullable_date` must not be nullable."
    ]
    assert errors(RangePartitioning("name", PartitionInterval.DAY)) == [
        "Range partitioning needs a DateTimeField, `name` is a CharField."
    ]
    assert errors(RangePartitioning("id", PartitionInterval.DAY)) == [
        "Range partitioning needs a DateTimeField, `id` is a BoundedBigAutoField.",
        "Range partitioning on the primary key is not supported.",
    ]
    assert errors(HashPartitioning("date_added", modulus=4)) == [
        "Hash partitioning needs an integer field, `date_added` is a DateTimeField."
    ]


@isolate_apps("fixtures")
def test_spec_rules() -> None:
    class Fields(Model):
        __relocation_scope__ = RelocationScope.Excluded

        date_added = models.DateTimeField()

        class Meta:
            app_label = "fixtures"

    assert get_model_partitioning_errors(Fields, HashPartitioning("id", modulus=1)) == [
        "`modulus` must be between 2 and 1024, got 1."
    ]
    assert get_model_partitioning_errors(
        Fields,
        RangePartitioning(
            "date_added", PartitionInterval.DAY, premake=0, retention=timedelta(days=-1)
        ),
    ) == [
        "`premake` must be at least 1, got 0.",
        "`retention` must be positive, got -1 day, 0:00:00.",
    ]


@isolate_apps("fixtures")
def test_uniqueness_must_include_the_partition_field() -> None:
    class Uniques(Model):
        __relocation_scope__ = RelocationScope.Excluded

        date_added = models.DateTimeField()
        guid = models.CharField(max_length=32, unique=True)
        name = models.CharField(max_length=10)

        class Meta:
            app_label = "fixtures"
            unique_together = (("name", "guid"),)
            constraints = [
                models.UniqueConstraint(fields=["name"], name="uniques_name_uniq"),
                models.UniqueConstraint(F("name"), F("date_added"), name="uniques_expr_uniq"),
                ExclusionConstraint(
                    name="uniques_exclude", expressions=[("name", "=")], index_type="gist"
                ),
            ]

    assert get_model_partitioning_errors(Uniques, WEEKLY) == [
        "`guid` is unique but is not the partition field `date_added`.",
        "unique_together ('name', 'guid') must include the partition field `date_added`.",
        "Unique constraint `uniques_name_uniq` must include the partition field `date_added`.",
        "Unique constraint `uniques_expr_uniq` uses expressions, which can't be checked to "
        "include the partition field.",
        "Exclusion constraint `uniques_exclude` is not supported on partitioned tables.",
    ]


@isolate_apps("fixtures")
def test_foreign_keys_into_range_partitioned_tables_are_rejected() -> None:
    class Partitioned(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = WEEKLY

        date_added = models.DateTimeField()

        class Meta:
            app_label = "fixtures"

    class Referencing(Model):
        __relocation_scope__ = RelocationScope.Excluded

        partitioned = FlexibleForeignKey(Partitioned)
        unconstrained = FlexibleForeignKey(Partitioned, db_constraint=False, related_name="+")

        class Meta:
            app_label = "fixtures"

    assert get_relation_errors([Partitioned, Referencing]) == [
        "Referencing.partitioned is a foreign key into range partitioned Partitioned. "
        "Use a plain id column or `db_constraint=False`."
    ]
    with pytest.raises(ImproperlyConfigured, match="Invalid foreign keys"):
        validate_all_models([Partitioned, Referencing])


@isolate_apps("fixtures")
def test_foreign_keys_into_hash_partitioned_tables() -> None:
    class OnPk(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = HashPartitioning("id", modulus=4)

        class Meta:
            app_label = "fixtures"

    class OnOther(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = HashPartitioning("bucket", modulus=4)

        bucket = models.IntegerField()

        class Meta:
            app_label = "fixtures"

    class Referencing(Model):
        __relocation_scope__ = RelocationScope.Excluded

        on_pk = FlexibleForeignKey(OnPk)
        on_other = FlexibleForeignKey(OnOther)

        class Meta:
            app_label = "fixtures"

    assert get_relation_errors([OnPk, OnOther, Referencing]) == [
        "Referencing.on_other is a foreign key into OnOther, which is hash partitioned on "
        "`bucket` instead of its primary key. Use a plain id column or `db_constraint=False`."
    ]


@isolate_apps("fixtures")
def test_range_partitioned_tables_cannot_have_foreign_keys() -> None:
    class Target(Model):
        __relocation_scope__ = RelocationScope.Excluded

        class Meta:
            app_label = "fixtures"

    class Partitioned(Model):
        __relocation_scope__ = RelocationScope.Excluded

        date_added = models.DateTimeField()
        target = FlexibleForeignKey(Target)
        unconstrained = FlexibleForeignKey(Target, db_constraint=False, related_name="+")

        class Meta:
            app_label = "fixtures"

    assert get_model_partitioning_errors(Partitioned, WEEKLY) == [
        "`target` is a database foreign key, which range partitioned tables can't have. "
        "Use `db_constraint=False`."
    ]
    # Hash partitions are never attached or dropped after the table is created.
    assert get_model_partitioning_errors(Partitioned, HashPartitioning("id", modulus=4)) == []


@isolate_apps("fixtures")
def test_hash_partitioning_on_a_lazy_foreign_key() -> None:
    # Defining a model with a foreign key to a model defined later must not fail.
    class Partitioned(Model):
        __relocation_scope__ = RelocationScope.Excluded
        __partitioning__ = HashPartitioning("parent", modulus=4)

        parent = FlexibleForeignKey("fixtures.LaterParent")
        other = FlexibleForeignKey("fixtures.LaterUuidParent", related_name="+")

        class Meta:
            app_label = "fixtures"

    class LaterParent(Model):
        __relocation_scope__ = RelocationScope.Excluded

        class Meta:
            app_label = "fixtures"

    class LaterUuidParent(Model):
        __relocation_scope__ = RelocationScope.Excluded

        id = models.UUIDField(primary_key=True)

        class Meta:
            app_label = "fixtures"

    # Once every model is loaded, the referenced primary key is checked.
    validate_all_models([Partitioned, LaterParent, LaterUuidParent])
    assert get_model_partitioning_errors(Partitioned, HashPartitioning("other", modulus=4)) == [
        "Hash partitioning needs an integer field, `other` is a FlexibleForeignKey."
    ]
