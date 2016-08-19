from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

import six

from django import forms


class PluginConfigMixin(object):
    def field_to_config(self, name, field):
        config = {
            'name': name,
            'label': field.label,
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

    def get_config(self, request, project, **kwargs):
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
