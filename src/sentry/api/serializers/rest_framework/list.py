from __future__ import absolute_import

import six

from collections import defaultdict
from rest_framework.serializers import WritableField, ValidationError


class ListField(WritableField):
    def __init__(self, child=None, allow_null=True, **kwargs):
        if child:
            assert isinstance(child, WritableField)
        self.child = child
        self.allow_null = allow_null
        super(ListField, self).__init__(**kwargs)
        self._child_errors = defaultdict(list)

    def initialize(self, parent, field_name):
        super(ListField, self).initialize(parent, field_name)
        if self.child:
            self.child._errors = []
            self._child_errors = defaultdict(list)
            self.child.initialize(parent, field_name)

    def to_native(self, value):
        return value

    def from_native(self, value):
        if value is None:
            return None

        if not value:
            return []

        if not isinstance(value, list):
            msg = 'Incorrect type. Expected a list, but got %s'
            raise ValidationError(msg % type(value).__name__)

        if self.child is None:
            return value

        children = []
        for item in value:
            children.append(self.child.from_native(item))
            self.add_child_errors()
        return children

    def format_child_errors(self):
        errors = []
        for k, v in six.iteritems(self._child_errors):
            errors.append('%s: %s' % (k, v[0]))
        return ', '.join(errors)

    def validate(self, value):
        # Allow empty lists when required=True unless child is also marked as required
        if (value is None and self.required) or \
                (not value and self.required and self.child and self.child.required):
            raise ValidationError(self.error_messages['required'])

        if not isinstance(value, list):
            msg = 'Incorrect type. Expected a list, but got %s'
            raise ValidationError(msg % type(value).__name__)

        if self.child:
            # the `self.child.from_native` call might have already
            # validated/changed data so check for child errors first
            if self._child_errors:
                raise ValidationError(self.format_child_errors())
            for item in value:
                if item is None and not self.allow_null:
                    raise ValidationError('Incorrect type. Expected value, but got null')
                self.child.validate(item)
                self.add_child_errors()

    def run_validators(self, value):
        if self.child:
            for item in value:
                self.child.run_validators(item)
                self.add_child_errors()

    def add_child_errors(self):
        if not isinstance(self.child._errors, dict):
            return
        for k, v in six.iteritems(self.child._errors):
            self._child_errors[k] += v
