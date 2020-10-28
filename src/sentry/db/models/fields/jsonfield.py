from __future__ import absolute_import, unicode_literals

import datetime
import six

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models
from django.db.models.lookups import Exact, IExact, In, Contains, IContains
from django.utils.translation import ugettext_lazy as _

from sentry.utils import json
from sentry.db.models.utils import Creator


def default(o):
    if hasattr(o, "to_json"):
        return o.to_json()
    if isinstance(o, Decimal):
        return six.text_type(o)
    if isinstance(o, datetime.datetime):
        if o.tzinfo:
            return o.strftime("%Y-%m-%dT%H:%M:%S%z")
        return o.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(o, datetime.date):
        return o.strftime("%Y-%m-%d")
    if isinstance(o, datetime.time):
        if o.tzinfo:
            return o.strftime("%H:%M:%S%z")
        return o.strftime("%H:%M:%S")

    raise TypeError(repr(o) + " is not JSON serializable")


class JSONField(models.TextField):
    """
    A field that will ensure the data entered into it is valid JSON.

    Originally from https://github.com/adamchainz/django-jsonfield/blob/0.9.13/jsonfield/fields.py
    Adapted to fit our requirements of:

    - always using a text field
    - being able to serialize dates/decimals
    - not emitting deprecation warnings
    """

    default_error_messages = {"invalid": _("'%s' is not a valid JSON string.")}
    description = "JSON object"

    def __init__(self, *args, **kwargs):
        if not kwargs.get("null", False):
            kwargs["default"] = kwargs.get("default", dict)
        self.encoder_kwargs = {
            "indent": kwargs.pop("indent", getattr(settings, "JSONFIELD_INDENT", None))
        }
        super(JSONField, self).__init__(*args, **kwargs)
        self.validate(self.get_default(), None)

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super(JSONField, self).contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))

    def validate(self, value, model_instance):
        if not self.null and value is None:
            raise ValidationError(self.error_messages["null"])
        try:
            self.get_prep_value(value)
        except BaseException:
            raise ValidationError(self.error_messages["invalid"] % value)

    def get_default(self):
        if self.has_default():
            default = self.default
            if callable(default):
                default = default()
            if isinstance(default, six.string_types):
                return json.loads(default)
            return json.loads(json.dumps(default))
        return super(JSONField, self).get_default()

    def get_internal_type(self):
        return "TextField"

    def db_type(self, connection):
        return "text"

    def to_python(self, value):
        if isinstance(value, six.string_types):
            if value == "":
                if self.null:
                    return None
                if self.blank:
                    return ""
            try:
                value = json.loads(value)
            except ValueError:
                msg = self.error_messages["invalid"] % value
                raise ValidationError(msg)
        # TODO: Look for date/time/datetime objects within the structure?
        return value

    def get_db_prep_value(self, value, connection=None, prepared=None):
        return self.get_prep_value(value)

    def get_prep_value(self, value):
        if value is None:
            if not self.null and self.blank:
                return ""
            return None
        return json.dumps(value, default=default, **self.encoder_kwargs)

    def value_to_string(self, obj):
        return self._get_val_from_obj(obj)


class NoPrepareMixin(object):
    def get_prep_lookup(self):
        return self.rhs


class JSONFieldExactLookup(NoPrepareMixin, Exact):
    def get_prep_lookup(self):
        return self.lhs.output_field.to_python(self.lhs.output_field.get_prep_value(self.rhs))


class JSONFieldIExactLookup(NoPrepareMixin, IExact):
    def get_prep_lookup(self):
        return self.lhs.output_field.to_python(self.lhs.output_field.get_prep_value(self.rhs))


class JSONFieldInLookup(NoPrepareMixin, In):
    def get_prep_lookup(self):
        return [
            self.lhs.output_field.to_python(self.lhs.output_field.get_prep_value(v))
            for v in self.rhs
        ]


class ContainsLookupMixin(object):
    def get_prep_lookup(self):
        if isinstance(self.rhs, (list, tuple)):
            raise TypeError(
                "Lookup type %r not supported with %s argument"
                % (self.lookup_name, type(self.rhs).__name__)
            )
        if isinstance(self.rhs, dict):
            return self.lhs.output_field.get_prep_value(self.rhs)[1:-1]
        return self.lhs.output_field.to_python(self.lhs.output_field.get_prep_value(self.rhs))


class JSONFieldContainsLookup(ContainsLookupMixin, Contains):
    pass


class JSONFieldIContainsLookup(ContainsLookupMixin, IContains):
    pass


JSONField.register_lookup(JSONFieldExactLookup)
JSONField.register_lookup(JSONFieldIExactLookup)
JSONField.register_lookup(JSONFieldInLookup)
JSONField.register_lookup(JSONFieldContainsLookup)
JSONField.register_lookup(JSONFieldIContainsLookup)
