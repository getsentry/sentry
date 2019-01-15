from __future__ import absolute_import

import six
from django.utils.translation import ugettext_lazy as _
from rest_framework.serializers import WritableField, ValidationError
from sentry.utils import json

# JSONField taken from Django rest framework version 3.9.0
# See https://github.com/encode/django-rest-framework/blob/0eb2dc1137189027cc8d638630fb1754b02d6cfa/rest_framework/fields.py
# or https://www.django-rest-framework.org/api-guide/fields/#jsonfield
# for more information


class JSONField(WritableField):
    default_error_messages = {
        'invalid': _('Value must be valid JSON.')
    }

    def __init__(self, *args, **kwargs):
        self.binary = kwargs.pop('binary', False)
        super(JSONField, self).__init__(*args, **kwargs)

    def to_native(self, value):
        if self.binary:
            value = json.dumps(value)
            # On python 2.x the return type for json.dumps() is underspecified.
            # On python 3.x json.dumps() returns unicode strings.
            if isinstance(value, six.text_type):
                value = bytes(value.encode('utf-8'))
        return value

    def from_native(self, data):
        try:
            if self.binary:
                if isinstance(data, bytes):
                    data = data.decode('utf-8')
                return json.loads(data)
            else:
                json.dumps(data)
        except (TypeError, ValueError):
            raise ValidationError(self.default_error_messages['invalid'])
        return data
