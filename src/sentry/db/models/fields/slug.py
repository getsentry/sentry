from django.db.models import SlugField

from sentry.slug.validators import no_numeric_validator, org_slug_validator


class SentrySlugField(SlugField):
    default_validators = [*SlugField.default_validators, no_numeric_validator]


class SentryOrgSlugField(SlugField):
    default_validators = [*SlugField.default_validators, org_slug_validator]
