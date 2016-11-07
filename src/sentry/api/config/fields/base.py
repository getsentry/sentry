from __future__ import absolute_import

from rest_framework import serializers


class ConfigFieldMixin(object):
    @classmethod
    def from_definition(cls, field):
        return cls(**field)

    def to_definition(self):
        raise NotImplementedError


class StringField(ConfigFieldMixin, CharField):
    def to_definition(self):
        return {
            'type': 'text',
            'help': self.help_text,
            'label': self.label,
            'name': self.name,
            # 'placeholder': self.placeholder,
        }


class ChoiceField(ConfigFieldMixin, ChoiceField):
    def to_definition(self):
        return {
            'type': 'choice',
            'help': self.help_text,
            'label': self.label,
            'name': self.name,
            'choices': self.choices,
            # 'placeholder': self.placeholder,
        }
