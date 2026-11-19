"""
Rules a model must follow to declare ``__partitioning__``.

They are checked whether or not the table is partitioned in the current environment,
so a model behaves the same in every environment and can be switched over later.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from django.contrib.postgres.constraints import ExclusionConstraint
from django.core.exceptions import FieldDoesNotExist, ImproperlyConfigured
from django.db import models

from sentry.db.partitions.spec import (
    MAX_HASH_MODULUS,
    HashPartitioning,
    PartitioningSpec,
    RangePartitioning,
)

DOCS_HINT = "See the partitioning section of the `generate-migration` skill."


def _get_spec(model: type[models.Model]) -> PartitioningSpec | None:
    return getattr(model, "__partitioning__", None)


def has_db_constraint(field: models.Field[Any, Any]) -> bool:
    """Whether ``field`` is a relation backed by a database foreign key constraint."""
    return field.remote_field is not None and bool(getattr(field, "db_constraint", False))


def _is_integer_field(field: models.Field[Any, Any]) -> bool | None:
    """``None`` when it can't be told yet."""
    if isinstance(field, models.ForeignKey):
        # A string reference to a model defined later is only resolved once that model
        # is loaded. `validate_all_models` checks it again once every model is.
        if isinstance(field.remote_field.model, str):
            return None
        return _is_integer_field(field.target_field)
    return isinstance(field, models.IntegerField)


def _spec_errors(spec: object) -> list[str]:
    if isinstance(spec, RangePartitioning):
        errors = []
        if spec.premake < 1:
            errors.append(f"`premake` must be at least 1, got {spec.premake}.")
        if spec.retention is not None and spec.retention <= timedelta(0):
            errors.append(f"`retention` must be positive, got {spec.retention}.")
        return errors
    if isinstance(spec, HashPartitioning):
        if not 2 <= spec.modulus <= MAX_HASH_MODULUS:
            return [f"`modulus` must be between 2 and {MAX_HASH_MODULUS}, got {spec.modulus}."]
        return []
    return [f"`__partitioning__` must be RangePartitioning or HashPartitioning, got {spec!r}."]


def _partition_field_errors(model: type[models.Model], spec: PartitioningSpec) -> list[str]:
    try:
        field = model._meta.get_field(spec.field)
    except FieldDoesNotExist:
        return [f"The partition field `{spec.field}` does not exist."]
    if not isinstance(field, models.Field) or not field.concrete:
        return [f"The partition field `{spec.field}` must be a concrete field."]

    errors = []
    if field.null:
        errors.append(f"The partition field `{spec.field}` must not be nullable.")
    if isinstance(spec, RangePartitioning):
        if not isinstance(field, models.DateTimeField):
            errors.append(
                f"Range partitioning needs a DateTimeField, `{spec.field}` is a "
                f"{type(field).__name__}."
            )
        if field.primary_key:
            errors.append("Range partitioning on the primary key is not supported.")
    elif _is_integer_field(field) is False:
        errors.append(
            f"Hash partitioning needs an integer field, `{spec.field}` is a {type(field).__name__}."
        )
    return errors


def _foreign_key_errors(model: type[models.Model], spec: PartitioningSpec) -> list[str]:
    # Range partitions are attached and dropped while the table is live. Attaching a
    # partition takes SHARE ROW EXCLUSIVE on every table the partitioned table has a
    # foreign key to, and dropping a detached partition takes ACCESS EXCLUSIVE on
    # them, so each partition change would block traffic on those tables. Hash
    # partitions are only created together with the table and never dropped.
    if not isinstance(spec, RangePartitioning):
        return []
    return [
        f"`{field.name}` is a database foreign key, which range partitioned tables can't "
        f"have. Use `db_constraint=False`."
        for field in model._meta.concrete_fields
        if has_db_constraint(field)
    ]


def _uniqueness_errors(model: type[models.Model], spec: PartitioningSpec) -> list[str]:
    # Postgres can only enforce uniqueness on a partitioned table when the unique
    # columns include every partition key column.
    opts = model._meta
    errors = []
    for field in opts.concrete_fields:
        if field.unique and not field.primary_key and field.name != spec.field:
            errors.append(
                f"`{field.name}` is unique but is not the partition field `{spec.field}`."
            )
    for fields in opts.unique_together:
        if spec.field not in fields:
            errors.append(
                f"unique_together {tuple(fields)} must include the partition field `{spec.field}`."
            )
    for constraint in opts.constraints:
        if isinstance(constraint, ExclusionConstraint):
            errors.append(
                f"Exclusion constraint `{constraint.name}` is not supported on partitioned tables."
            )
        elif isinstance(constraint, models.UniqueConstraint):
            if constraint.expressions:
                errors.append(
                    f"Unique constraint `{constraint.name}` uses expressions, which can't be "
                    f"checked to include the partition field."
                )
            elif spec.field not in constraint.fields:
                errors.append(
                    f"Unique constraint `{constraint.name}` must include the partition field "
                    f"`{spec.field}`."
                )
    return errors


def get_model_partitioning_errors(
    model: type[models.Model], spec: PartitioningSpec | None = None
) -> list[str]:
    spec = spec if spec is not None else _get_spec(model)
    if spec is None:
        return []
    errors = _spec_errors(spec)
    if errors:
        return errors

    opts = model._meta
    if opts.proxy or not opts.managed:
        return ["Only concrete, managed models can be partitioned."]
    if opts.db_tablespace:
        errors.append("Partitioned tables can't set `db_tablespace`.")
    if not isinstance(opts.pk, models.Field) or not opts.pk.concrete:
        errors.append("Partitioned models need a single concrete primary key field.")
    errors.extend(_partition_field_errors(model, spec))
    errors.extend(_foreign_key_errors(model, spec))
    errors.extend(_uniqueness_errors(model, spec))
    return errors


def validate_model_partitioning(
    model: type[models.Model], spec: PartitioningSpec | None = None
) -> None:
    """Raise ``ImproperlyConfigured`` if ``model`` can't be partitioned as declared."""
    errors = get_model_partitioning_errors(model, spec)
    if errors:
        details = "\n".join(f"  - {error}" for error in errors)
        raise ImproperlyConfigured(
            f"{model.__module__}.{model.__name__} has an invalid `__partitioning__`:\n"
            f"{details}\n{DOCS_HINT}"
        )


def get_relation_errors(all_models: Iterable[type[models.Model]]) -> list[str]:
    """
    Foreign keys from other tables into partitioned tables.

    A foreign key has to reference a unique constraint, and on a partitioned table
    every unique constraint includes the partition key. Range partitioned tables
    have a ``(pk, partition field)`` primary key, which Django foreign keys can't
    reference. Hash partitioned tables can be referenced only when they are
    partitioned on their primary key.
    """
    errors = []
    for model in all_models:
        for field in model._meta.concrete_fields:
            if not isinstance(field, models.ForeignKey) or not has_db_constraint(field):
                continue
            target = field.remote_field.model
            spec = _get_spec(target)
            if spec is None:
                continue
            source = f"{model.__name__}.{field.name}"
            if isinstance(spec, RangePartitioning):
                errors.append(
                    f"{source} is a foreign key into range partitioned {target.__name__}. "
                    f"Use a plain id column or `db_constraint=False`."
                )
            elif not (
                field.target_field.primary_key
                and target._meta.pk is not None
                and target._meta.pk.name == spec.field
            ):
                errors.append(
                    f"{source} is a foreign key into {target.__name__}, which is hash "
                    f"partitioned on `{spec.field}` instead of its primary key. Use a plain id "
                    f"column or `db_constraint=False`."
                )
    return errors


def validate_all_models(all_models: Iterable[type[models.Model]]) -> None:
    """Validate every declaration and every foreign key into a partitioned table."""
    model_list = list(all_models)
    for model in model_list:
        validate_model_partitioning(model)
    errors = get_relation_errors(model_list)
    if errors:
        details = "\n".join(f"  - {error}" for error in errors)
        raise ImproperlyConfigured(
            f"Invalid foreign keys into partitioned tables:\n{details}\n{DOCS_HINT}"
        )
