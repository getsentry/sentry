from __future__ import absolute_import

from rest_framework import serializers


class MultipleChoiceField(serializers.WritableField):
    error_messages = {
        'invalid_choice': ('Select a valid choice. {value} is not one of '
                           'the available choices.'),
    }

    def from_native(self, data):
        if isinstance(data, list):
            for item in data:
                if item not in self.choices:
                    raise serializers.ValidationError(self.error_messages['invalid_choice'].format(
                        value=item,
                    ))
            return data
        raise serializers.ValidationError('Please provide a valid list.')

    def to_native(self, value):
        return value

    def __init__(self, choices=None, *args, **kwargs):
        self.choices = set(choices or ())
        super(MultipleChoiceField, self).__init__(*args, **kwargs)
