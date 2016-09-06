from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

import six

from django import forms

from .validators import DEFAULT_VALIDATORS


class PluginConfigMixin(object):
    asset_key = None
    assets = []

    def field_to_config(self, name, field):
        config = {
            'name': name,
            'label': field.label or name.replace('_', ' ').title(),
            'placeholder': field.widget.attrs.get('placeholder'),
            'help': field.help_text,
            'required': field.required,
        }
        if isinstance(field, forms.URLField):
            config['type'] = 'url'
        elif isinstance(field, forms.CharField):
            if isinstance(field.widget, forms.PasswordInput):
                config['type'] = 'secret'
            elif isinstance(field.widget, forms.Textarea):
                config['type'] = 'textarea'
            else:
                config['type'] = 'text'
        elif isinstance(field, forms.ChoiceField):
            config['type'] = 'select'
            config['choices'] = field.choices
        return config

    def get_assets(self):
        return self.assets

    def get_metadata(self):
        """
        Return extra metadata which is used to represent this plugin.

        This is available via the API, and commonly used for runtime
        configuration that changes per-install, but not per-project.
        """
        return {}

    def get_config(self, project, **kwargs):
        form = self.project_conf_form
        if not form:
            return []

        config = []
        for name, field in six.iteritems(form.base_fields):
            row = self.field_to_config(name, field)
            row['default'] = field.initial
            config.append(row)
        return config

    def validate_config_field(self, project, name, value, actor=None):
        """
        ```
        if name == 'foo' and value != 'bar':
            raise PluginError('foo must be bar')
        return value
        ```
        """
        for config in self.get_config(project):
            if config['name'] != name:
                continue

            for validator in DEFAULT_VALIDATORS.get(config['type'], ()):
                value = validator(project=project, value=value, actor=actor)

            for validator in config.get('validators', ()):
                value = validator(value, project=project, actor=actor)
            return value
        return value

    def validate_config(self, project, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        return config

    def get_group_urls(self):
        return []

    def get_project_urls(self):
        return []
