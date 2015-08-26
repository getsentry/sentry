from __future__ import absolute_import

from rest_framework.serializers import WritableField, ValidationError


class ListField(WritableField):
    def __init__(self, child):
        self.child = child
        super(ListField, self).__init__()

    def initialize(self, **kwargs):
        super(ListField, self).initialize(**kwargs)
        self.child.initialize(**kwargs)

    def to_native(self, obj):
        return obj

    def from_native(self, data):
        if not isinstance(data, list):
            msg = 'Incorrect type. Expected a mapping, but got %s'
            raise ValidationError(msg % type(data).__name__)

        return map(self.child.from_native, data)
