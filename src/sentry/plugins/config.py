from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

import six

from django import forms


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
        if isinstance(field, forms.CharField):
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

    def get_group_urls(self):
        return []

    def get_project_urls(self):
        return []
