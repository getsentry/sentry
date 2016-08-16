from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

from django import forms


class PluginConfigMixin(object):
    def field_to_config(self, name, field):
        config = {
            'name': name,
            'label': field.label,
            'placeholder': field.widget.attrs.get('placeholder'),
            'help': field.help_text,
        }
        if isinstance(field, forms.CharField):
            if field.widget == forms.Textarea:
                config['type'] = 'textarea'
            else:
                config['type'] = 'text'
        elif isinstance(field, forms.ChoiceField):
            config['type'] = 'select'
            config['choices'] = field.choices
        return config

    def get_group_urls(self):
        return []

    def get_project_urls(self):
        return []
