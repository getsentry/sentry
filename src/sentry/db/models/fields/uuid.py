import importlib
from uuid import UUID, uuid4

from django.db import models
from django.db.models.fields import NOT_PROVIDED
from psycopg2.extensions import register_adapter

from sentry.db.models.utils import Creator


# Adapted from django-pgfields
# https://github.com/lukesneeringer/django-pgfields/blob/master/django_pg/models/fields/uuid.py
class UUIDField(models.Field):
    """Field for storing UUIDs."""

    description = "Universally unique identifier."

    def __init__(self, auto_add=False, coerce_to=UUID, **kwargs):
        """Instantiate the field."""

        # If the `auto_add` argument is specified as True, substitute an
        # appropriate callable which requires no arguments and will return
        # a UUID.
        if auto_add is True:
            auto_add = uuid4

        # If the `auto_add` arguments is specified as a string
        # parse out and import the callable.
        if isinstance(auto_add, str):
            module_name, member = auto_add.split(":")
            module = importlib.import_module(module_name)
            auto_add = getattr(module, member)

        # Save the `auto_add` and `coerce_to` rules.
        self._auto_add = auto_add
        self._coerce_to = coerce_to

        # If `auto_add` is enabled, it should imply that the field
        # is not editable, and should not show up in ModelForms.
        if auto_add and "editable" not in kwargs:
            kwargs["editable"] = False

        # Blank values shall be nulls.
        if kwargs.get("blank", False) and not kwargs.get("null", False):
            raise AttributeError(
                " ".join(
                    (
                        "Blank UUIDs are stored as NULL. Therefore, setting",
                        "`blank` to True requires `null` to be True.",
                    )
                )
            )

        # Enforce CHAR(32) for unsupported engines
        kwargs["max_length"] = 32

        # Now pass the rest of the work to CharField.
        super().__init__(**kwargs)

    def db_type(self, connection):
        return "uuid"

    def get_internal_type(self):
        return "CharField"

    def get_prep_value(self, value):
        """Return a wrapped, valid UUID value."""

        # If the value is None, return None.
        if not value:
            if self.null or self._auto_add or (self.default != NOT_PROVIDED):
                return None
            raise ValueError(
                "Explicit UUID required unless either `null` is " "True or `auto_add` is given."
            )

        # If we already have a UUID, pass it through.
        if isinstance(value, UUID):
            return value

        # Convert our value to a UUID.
        return UUID(value)

    def pre_save(self, instance, add):
        """If auto is set, generate a UUID at random."""

        # If the `auto_add` option was set, and there is no value
        # on the model instance, then generate a UUID using the given
        # callable.
        if self._auto_add and add and not getattr(instance, self.attname):
            uuid_value = self._auto_add()

            # Save the UUID to the model instance
            setattr(instance, self.attname, uuid_value)
            return uuid_value

        # This is the standard case; just use the superclass logic.
        return super().pre_save(instance, add)

    def contribute_to_class(self, cls, name):
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def to_python(self, value):
        """Return a UUID object."""
        if isinstance(value, self._coerce_to) or not value:
            return value
        return self._coerce_to(value)

    @property
    def _auto_add_str(self):
        """Return a dot path, as a string, of the `_auto_add` callable.
        If `_auto_add` is a boolean, return it unchanged.
        """
        if isinstance(self._auto_add, bool):
            return self._auto_add
        return f"{self._auto_add.__module__}:{self._auto_add.__name__}"


class UUIDAdapter:
    def __init__(self, value):
        if not isinstance(value, UUID):
            raise TypeError("UUIDAdapter only understands UUID objects.")
        self.value = value

    def getquoted(self):
        return ("'%s'" % self.value).encode("utf8")


# Register the UUID type with psycopg2.
register_adapter(UUID, UUIDAdapter)
