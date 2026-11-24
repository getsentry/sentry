from typing import TYPE_CHECKING

from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import SlugField
from django.db.models.lookups import Lookup
from django.db.models.sql.compiler import SQLCompiler

from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.utils.slug import no_numeric_validator, org_slug_validator

DEFAULT_SLUG_MAX_LENGTH = 50

if TYPE_CHECKING:
    _SlugField = SlugField[str, str]
    _Lookup = Lookup[str | int]
else:
    _SlugField = SlugField
    _Lookup = Lookup


class SentrySlugField(_SlugField):
    default_validators = [*SlugField.default_validators, no_numeric_validator]


class SentryOrgSlugField(_SlugField):
    default_validators = [*SlugField.default_validators, org_slug_validator]


class IdOrSlugLookup(_Lookup):
    lookup_name = "id_or_slug"

    def as_sql(
        self, compiler: SQLCompiler, connection: BaseDatabaseWrapper
    ) -> tuple[str, list[str | int] | tuple[str | int, ...]]:
        lhs, lhs_params = self.process_lhs(compiler, connection)
        rhs, rhs_params = self.process_rhs(compiler, connection)

        # Use Django's built-in SQL compiler methods to properly quote table and column names
        # lhs initially looks like "table_name"."column_name"
        table_name = lhs.split(".")[0] if "." in lhs else None

        if table_name:
            table_name_quoted = compiler.quote_name_unless_alias(table_name)
            id_column_quoted = compiler.quote_name_unless_alias("id")
            slug_column_quoted = compiler.quote_name_unless_alias("slug")
        else:
            # If no table name, assume default quoting
            id_column_quoted = '"id"'
            slug_column_quoted = '"slug"'

        if rhs_params and str(rhs_params[0]).isdecimal():
            try:
                id_value = int(rhs_params[0])
            except ValueError:
                return "0 = 1", []

            if id_value > BoundedBigAutoField.MAX_VALUE:
                return "0 = 1", []

            # If numeric, use the 'id' field for comparison
            if table_name:
                return f"{table_name_quoted}.{id_column_quoted} = {rhs}", [id_value]
            else:
                return f"{id_column_quoted} = {rhs}", [id_value]
        else:
            # If not numeric, use the 'slug' field for comparison
            if table_name:
                return f"{table_name_quoted}.{slug_column_quoted} = {rhs}", rhs_params
            else:
                return f"{slug_column_quoted} = {rhs}", rhs_params


SentrySlugField.register_lookup(IdOrSlugLookup)
SentryOrgSlugField.register_lookup(IdOrSlugLookup)
