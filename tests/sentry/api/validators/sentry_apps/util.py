from __future__ import absolute_import

from jsonschema import ValidationError
from sentry.api.validators.sentry_apps.schema import validate, SCHEMA


def invalid_schema(func):
    def inner(self, *args, **kwargs):
        with self.assertRaises(ValidationError):
            func(self)
    return inner


def validate_component(schema):
    """
    In order to test individual components, that aren't normally allowed at the
    top-level of a schema, we just plop all `definitions` into `properties`.
    This makes the validator think they're all valid top-level elements.
    """
    component_schema = SCHEMA.copy()
    component_schema['properties'] = component_schema['definitions']
    del component_schema['required']
    validate(instance={schema['type']: schema}, schema=component_schema)
