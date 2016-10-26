from __future__ import absolute_import

from rest_framework.serializers import WritableField, ValidationError


class ListField(WritableField):
    def __init__(self, child=None, **kwargs):
        self.child = child
        super(ListField, self).__init__(**kwargs)

    def initialize(self, **kwargs):
        super(ListField, self).initialize(**kwargs)
        if self.child is not None:
            self.child.initialize(**kwargs)

    def to_native(self, obj):
        return obj

    def from_native(self, data):
        if not isinstance(data, list):
            msg = 'Incorrect type. Expected a list, but got %s'
            raise ValidationError(msg % type(data).__name__)

        if self.child is None:
            return data
        return [self.child.from_native(x) for x in data]

    def run_validators(self, value):
        super(ListField, self).run_validators(value)
        if self.child is not None:
            for cv in value:
                self.child.run_validators(cv)
