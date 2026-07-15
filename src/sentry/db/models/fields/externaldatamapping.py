from __future__ import annotations

from enum import StrEnum
from typing import Any

from django.core.checks import CheckMessage
from django.db import models

__all__ = ("ExternalDataMappingField", "ExternalMappingType")


class ExternalMappingType(StrEnum):
    """External system a column implicitly references."""

    # Abstraction layers (sentry.models.files / sentry.nodestore).
    FILESTORE = "filestore"
    NODESTORE = "nodestore"
    # Concrete stores.
    GCS = "gcs"
    S3 = "s3"
    BIGTABLE = "bigtable"
    POSTGRES = "postgres"  # cross-database / cross-silo implicit ids
    REDIS = "redis"
    KAFKA = "kafka"
    CLICKHOUSE = "clickhouse"


# Only scalar column types with verified delegation are supported. Relational
# fields are deliberately rejected: this wrapper exists to mark references
# Django does NOT model as relations.
_SUPPORTED_WRAPPED_FIELDS: tuple[type[models.Field[Any, Any]], ...] = (
    models.CharField,
    models.TextField,
    models.IntegerField,
)


class ExternalDataMappingField(models.Field[Any, Any]):
    """
    Pure-annotation wrapper marking a column as an implicit reference into
    another database or external system (GCS blob paths, cross-silo ids,
    redis keys, ...).

    Migration-transparent: ``deconstruct()`` masquerades as the wrapped
    field, so wrapping an existing column generates zero migrations and
    identical DDL. Tooling introspects annotations via
    ``isinstance(field, ExternalDataMappingField)`` over
    ``model._meta.get_fields()`` and reads ``mapping_type``,
    ``mapping_description``, and ``wrapped_field``.

    Consumers that isinstance-check concrete field classes (e.g. the
    ImplicitForeignKey heuristic in ``sentry.backup.dependencies``) must
    unwrap first: ``field = field.wrapped_field``.
    """

    # Exists on Field at runtime but is missing from django-stubs; declared
    # here so mirroring the wrapped field's descriptor in __init__ type-checks.
    descriptor_class: type[Any]

    def __init__(
        self,
        wrapped_field: models.Field[Any, Any],
        *,
        mapping_type: ExternalMappingType,
        description: str,
    ) -> None:
        if isinstance(wrapped_field, type):
            raise TypeError(
                "wrapped_field must be a field instance, e.g. models.TextField(null=True)"
            )
        if isinstance(wrapped_field, ExternalDataMappingField):
            raise TypeError("ExternalDataMappingField cannot be nested")
        if not isinstance(wrapped_field, _SUPPORTED_WRAPPED_FIELDS):
            raise TypeError(
                f"unsupported wrapped field type {type(wrapped_field).__name__}; "
                "supported base types: "
                f"{', '.join(c.__name__ for c in _SUPPORTED_WRAPPED_FIELDS)}"
            )
        if wrapped_field.remote_field is not None:
            raise TypeError("relational fields are not supported")
        if hasattr(wrapped_field, "model"):
            raise TypeError("wrapped_field is already bound to a model")
        if not isinstance(mapping_type, ExternalMappingType):
            raise TypeError("mapping_type must be an ExternalMappingType")
        if not description:
            raise ValueError("a non-empty description of the mapping is required")

        # NB: assign wrapped_field first -- __getattr__ depends on it.
        self.wrapped_field = wrapped_field

        # Initialize as a default Field, then mirror the wrapped field's
        # entire instance state so anything Django reads directly off the
        # field (schema editor, ORM compiler, autodetector, system checks)
        # sees values identical to the wrapped field's. Only the creation
        # counter stays ours (it drives field ordering and identity).
        super().__init__()
        creation_counter = self.creation_counter
        self.__dict__.update(wrapped_field.__dict__)
        self.creation_counter = creation_counter

        # These live on the wrapped field's *class*, not in its __dict__.
        self.empty_strings_allowed = wrapped_field.empty_strings_allowed
        self.empty_values = wrapped_field.empty_values
        self.descriptor_class = getattr(wrapped_field, "descriptor_class")

        # Field.validators / Field.error_messages are cached_propertys whose
        # values depend on the concrete field class (e.g. CharField appends a
        # MaxLengthValidator, IntegerField adds bounds validators). Compute
        # them on the wrapped field and share the result so the wrapper never
        # falls back to bare-Field defaults.
        self.validators = wrapped_field.validators
        self.error_messages = wrapped_field.error_messages

        self.mapping_type = mapping_type
        # Not `self.description`: Field.description is a read-only class
        # property.
        self.mapping_description = description

    # -- migration transparency ------------------------------------------------

    def deconstruct(self) -> tuple[Any, Any, Any, Any]:
        # Masquerade as the wrapped field: the migration autodetector compares
        # fields solely via deconstruct() output, so plain and wrapped columns
        # look identical and no migration is ever generated. The wrapped
        # field's deconstruct resolves through Sentry's patched
        # Field.deconstruct (src/sentry/new_migrations/monkey/fields.py),
        # keeping the output byte-identical to the plain field's.
        _, path, args, kwargs = self.wrapped_field.deconstruct()
        return self.name, path, args, kwargs

    def clone(self) -> ExternalDataMappingField:
        # Field.clone() rebuilds from deconstruct(), which -- masqueraded --
        # would feed the wrapped field's kwargs to our __init__. ModelState
        # .from_model() clones every field on each makemigrations run, and
        # abstract-model inheritance clones too, so rebuild explicitly.
        # Rebuild the wrapped field the same way Field.clone() would.
        _, _, args, kwargs = self.wrapped_field.deconstruct()
        return type(self)(
            type(self.wrapped_field)(*args, **kwargs),
            mapping_type=self.mapping_type,
            description=self.mapping_description,
        )

    # -- name/model plumbing (pattern: django.contrib.postgres ArrayField) ------

    @property
    def model(self) -> type[models.Model]:
        try:
            return self.__dict__["model"]
        except KeyError:
            raise AttributeError(f"{type(self).__name__!r} object has no attribute 'model'")

    @model.setter
    def model(self, model: type[models.Model]) -> None:
        self.__dict__["model"] = model
        self.wrapped_field.model = model

    def set_attributes_from_name(self, name: str) -> None:
        super().set_attributes_from_name(name)
        # The wrapped field's own methods (pre_save, value_from_object, ...)
        # read self.name/attname/column, so keep it bound in lockstep.
        self.wrapped_field.set_attributes_from_name(name)

    # -- attribute fallback ------------------------------------------------------

    def __getattr__(self, name: str) -> Any:
        # Fidelity net for wrapped-class attributes we don't mirror explicitly
        # (db_collation, MAX_VALUE, from_db_value, ...). The guard prevents
        # recursion during __copy__/unpickling before __dict__ is populated.
        if name == "wrapped_field":
            raise AttributeError(name)
        return getattr(self.wrapped_field, name)

    # -- system checks -----------------------------------------------------------

    def check(self, **kwargs: Any) -> list[CheckMessage]:
        return [*super().check(**kwargs), *self.wrapped_field.check(**kwargs)]

    # -- DB schema / SQL ---------------------------------------------------------

    def get_internal_type(self) -> str:
        return self.wrapped_field.get_internal_type()

    def db_type(self, connection: Any) -> str | None:
        return self.wrapped_field.db_type(connection)

    # rel_db_type, cast_db_type, db_type_suffix, and get_db_converters are
    # deliberately NOT overridden: their base Field implementations resolve
    # entirely through get_internal_type() / db_type() / db_type_parameters()
    # / hasattr(self, "from_db_value"), all of which delegate to the wrapped
    # field via the overrides here, the mirrored __dict__, and __getattr__.

    def db_check(self, connection: Any) -> str | None:
        return self.wrapped_field.db_check(connection)

    def db_parameters(self, connection: Any) -> dict[str, Any]:
        return self.wrapped_field.db_parameters(connection)

    def select_format(self, compiler: Any, sql: str, params: Any) -> tuple[str, Any]:
        return self.wrapped_field.select_format(compiler, sql, params)

    # -- value conversion ----------------------------------------------------------

    def get_prep_value(self, value: Any) -> Any:
        return self.wrapped_field.get_prep_value(value)

    def get_db_prep_value(self, value: Any, connection: Any, prepared: bool = False) -> Any:
        return self.wrapped_field.get_db_prep_value(value, connection, prepared=prepared)

    def get_db_prep_save(self, value: Any, connection: Any) -> Any:
        return self.wrapped_field.get_db_prep_save(value, connection)

    def to_python(self, value: Any) -> Any:
        return self.wrapped_field.to_python(value)

    def value_to_string(self, obj: models.Model) -> str:
        return self.wrapped_field.value_to_string(obj)

    def pre_save(self, model_instance: models.Model, add: bool) -> Any:
        return self.wrapped_field.pre_save(model_instance, add)

    def has_default(self) -> bool:
        return self.wrapped_field.has_default()

    def get_default(self) -> Any:
        return self.wrapped_field.get_default()

    # -- lookups / validation / forms ----------------------------------------------

    def get_lookup(self, lookup_name: str) -> Any:
        # Lookups are registered per class (e.g. IntegerField's bounds-aware
        # comparison lookups) and resolved via the MRO; a bare Field subclass
        # would silently miss them.
        return self.wrapped_field.get_lookup(lookup_name)

    def get_transform(self, lookup_name: str) -> Any:
        return self.wrapped_field.get_transform(lookup_name)

    def formfield(
        self, form_class: Any = None, choices_form_class: Any = None, **kwargs: Any
    ) -> Any:
        return self.wrapped_field.formfield(
            form_class=form_class, choices_form_class=choices_form_class, **kwargs
        )
