from django.db.models import SlugField
from django.db.models.lookups import Lookup

from sentry.slug.validators import no_numeric_validator, org_slug_validator


class SentrySlugField(SlugField):
    default_validators = [*SlugField.default_validators, no_numeric_validator]


class SentryOrgSlugField(SlugField):
    default_validators = [*SlugField.default_validators, org_slug_validator]


class IdOrSlugLookup(Lookup):
    lookup_name = "id_or_slug"

    def as_sql(self, compiler, connection):
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
            # If numeric, use the 'id' field for comparison
            if table_name:
                return f"{table_name_quoted}.{id_column_quoted} = {rhs}", rhs_params
            else:
                return f"{id_column_quoted} = {rhs}", rhs_params
        else:
            # If not numeric, use the 'slug' field for comparison
            if table_name:
                return f"{table_name_quoted}.{slug_column_quoted} = {rhs}", rhs_params
            else:
                return f"{slug_column_quoted} = {rhs}", rhs_params


SentrySlugField.register_lookup(IdOrSlugLookup)
SentryOrgSlugField.register_lookup(IdOrSlugLookup)
