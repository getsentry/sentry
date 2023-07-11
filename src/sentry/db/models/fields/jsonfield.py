"""
Adapted from https://github.com/adamchainz/django-jsonfield/blob/0.9.13/jsonfield/fields.py

Copyright (c) 2012, Matthew Schinckel.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * The names of its contributors may not be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MATTHEW SCHINCKEL BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.lookups import Contains, Exact, IContains, IExact, In, Lookup
from django.utils.translation import gettext_lazy as _

from sentry.db.models.utils import Creator
from sentry.utils import json


class JSONField(models.TextField):
    """
    A field that will ensure the data entered into it is valid JSON.

    Originally from https://github.com/adamchainz/django-jsonfield/blob/0.9.13/jsonfield/fields.py
    Adapted to fit our requirements of:

    - always using a text field
    - being able to serialize dates/decimals
    - not emitting deprecation warnings

    By default, this field will also invoke the Creator descriptor when setting the attribute.
    This can make it difficult to use json fields that receive raw strings, so optionally setting no_creator_hook=True
    surpresses this behavior.
    """

    # https://github.com/typeddjango/django-stubs/pull/1538
    default_error_messages = {"invalid": _("'%s' is not a valid JSON string.")}  # type: ignore[dict-item]
    description = "JSON object"
    no_creator_hook = False

    def __init__(self, *args, **kwargs):
        if not kwargs.get("null", False):
            kwargs["default"] = kwargs.get("default", dict)
        super().__init__(*args, **kwargs)
        self.validate(self.get_default(), None)

    def contribute_to_class(self, cls, name):
        """
        Add a descriptor for backwards compatibility
        with previous Django behavior.
        """
        super().contribute_to_class(cls, name)
        if not self.no_creator_hook:
            setattr(cls, name, Creator(self))

    def validate(self, value, model_instance):
        if not self.null and value is None:
            raise ValidationError(self.error_messages["null"])
        try:
            self.get_prep_value(value)
        except Exception:
            raise ValidationError(self.error_messages["invalid"] % value)

    def get_default(self):
        if self.has_default():
            default = self.default
            if callable(default):
                default = default()
            if isinstance(default, str):
                return json.loads(default)
            return json.loads(json.dumps(default))
        return super().get_default()

    def get_internal_type(self):
        return "TextField"

    def db_type(self, connection):
        return "text"

    def to_python(self, value):
        if isinstance(value, str) or self.no_creator_hook:
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
        return json.dumps(value)

    def value_to_string(self, obj):
        return self.value_from_object(obj)


class NoPrepareMixin(Lookup):
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


class ContainsLookupMixin(Lookup):
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
