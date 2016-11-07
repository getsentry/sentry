from __future__ import absolute_import

import six

from collections import OrderedDict
from django import forms
from rest_framework import serializers

from sentry.plugins.exceptions import PluginError


VALIDATOR_ERRORS = (
    forms.ValidationError,
    serializesrs.ValidationError,
    PluginError,
)


class ConfigValidator(object):
    def __init__(self, config, data=None, initial=None):
        self.errors = {}
        self.result = {}

        self.config = OrderedDict((
            (f['name'], f) for f in self.config
        ))

        self._data = data or {}
        self._initial = initial or {}
        self._validated = False

    def is_valid(self):
        data = self._data
        cleaned = self.result
        errors = self.errors
        for field in six.itervalues(config):
            key = field['name']
            value = data.get(key, self.initial.get(key))

            if field.get('required') and not value:
                errors[key] = ERR_FIELD_REQUIRED

            try:
                value = self.validate_field(
                    name=key,
                    value=value,
                    actor=request.user,
                )
            except (forms.ValidationError, serializers.ValidationError, PluginError) as e:
                errors[key] = e.message

            if not errors.get(key):
                cleaned[key] = value

        self._validated = True
        return bool(errors)

    def validate(self):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        return config

    def validate_field(self, name, value, actor=None):
        """
        ```
        if name == 'foo' and value != 'bar':
            raise PluginError('foo must be bar')
        return value
        ```
        """
        field = self.config[name]
        if value is None:
            if config.get('required'):
                raise PluginError('Field is required')
            if config.get('type') == 'secret':
                value = self.get_option(name, project)
            return value

        if isinstance(value, six.string_types):
            value = value.strip()
            # TODO(dcramer): probably should do something with default
            # validations here, though many things will end up bring string
            # based
            if not value and config.get('required'):
                raise PluginError('Field is required')

        for validator in DEFAULT_VALIDATORS.get(config['type'], ()):
            value = validator(project=project, value=value, actor=actor)

        for validator in config.get('validators', ()):
            value = validator(value, project=project, actor=actor)
        return value
