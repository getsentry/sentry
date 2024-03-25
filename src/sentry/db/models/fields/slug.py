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
        # We can ignore the lhs because we know that the lhs will
        # query either 'slug' or 'id'
        rhs, rhs_params = self.process_rhs(compiler, connection)

        if rhs_params and str(rhs_params[0]).isnumeric():
            # If numeric, use the 'id' field for comparison
            return f"id = {rhs}", rhs_params
        else:
            # If not numeric, use the 'slug' field for comparison
            return f"slug = {rhs}", rhs_params


SentrySlugField.register_lookup(IdOrSlugLookup)
