from __future__ import absolute_import

import six
from django.utils.translation import ugettext_lazy as _
from rest_framework.serializers import WritableField
from sentry.api.serializers.rest_framework.utils_json import json

# JSONField taken from Django rest framework version 3.9.0
# See https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py
# or https://www.django-rest-framework.org/api-guide/fields/#jsonfield
# for more information


class empty(object):
    """
    This class is used to represent no data being provided for a given input
    or output value.
    It is required because `None` may be a valid input or output value.
    """
    pass


def is_html_input(dictionary):
    # MultiDict type datastructures are used to represent HTML form input,
    # which may have more than one value for each key.
    return hasattr(dictionary, 'getlist')


class JSONField(WritableField):
    default_error_messages = {
        'invalid': _('Value must be valid JSON.')
    }

    def __init__(self, *args, **kwargs):
        self.binary = kwargs.pop('binary', False)
        super(JSONField, self).__init__(*args, **kwargs)

    def get_value(self, dictionary):
        if is_html_input(dictionary) and self.field_name in dictionary:
            # When HTML form input is used, mark up the input
            # as being a JSON string, rather than a JSON primitive.
            class JSONString(six.text_type):
                def __new__(self, value):
                    ret = six.text_type.__new__(self, value)
                    ret.is_json_string = True
                    return ret
            return JSONString(dictionary[self.field_name])
        return dictionary.get(self.field_name, empty)

    def to_internal_value(self, data):
        try:
            if self.binary or getattr(data, 'is_json_string', False):
                if isinstance(data, bytes):
                    data = data.decode('utf-8')
                return json.loads(data)
            else:
                json.dumps(data)
        except (TypeError, ValueError):
            self.fail('invalid')
        return data

    def to_representation(self, value):
        if self.binary:
            value = json.dumps(value)
            # On python 2.x the return type for json.dumps() is underspecified.
            # On python 3.x json.dumps() returns unicode strings.
            if isinstance(value, six.text_type):
                value = bytes(value.encode('utf-8'))
        return value
