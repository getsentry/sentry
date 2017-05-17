from __future__ import absolute_import

from rest_framework.serializers import WritableField, ValidationError


class ListField(WritableField):
    def __init__(self, child=None, allow_none=True, **kwargs):
        if child:
            assert isinstance(child, WritableField)
        self.child = child
        self.allow_none = allow_none
        super(ListField, self).__init__(**kwargs)

    def initialize(self, parent, field_name):
        super(ListField, self).initialize(parent, field_name)
        if self.child:
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

        return [self.child.from_native(item) for item in value]

    def validate(self, value):
        if not value and self.required:
            raise ValidationError(self.error_messages['required'])

        if not isinstance(value, list):
            msg = 'Incorrect type. Expected a list, but got %s'
            raise ValidationError(msg % type(value).__name__)

        if self.child:
            for item in value:
                if item is None and not self.allow_none:
                    raise ValidationError('Incorrect type. Expected value, but got null')
                self.child.validate(item)

    def run_validators(self, value):
        if self.child:
            for item in value:
                self.child.run_validators(item)
