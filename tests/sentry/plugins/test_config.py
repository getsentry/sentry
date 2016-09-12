from __future__ import absolute_import

import pytest

from django import forms

from sentry.exceptions import PluginError
from sentry.plugins import Plugin2
from sentry.testutils import TestCase


class DummyForm(forms.Form):
    text = forms.CharField(help_text='text field')
    textarea = forms.CharField(widget=forms.Textarea, required=False)
    password = forms.CharField(label='A Password', widget=forms.PasswordInput)
    choice = forms.ChoiceField(choices=((1, 'one'), (2, 'two')))
    url = forms.URLField()


class DummyPlugin(Plugin2):
    project_conf_form = DummyForm()


class ConfigTest(TestCase):
    def test_get_config(self):
        project = self.create_project()
        plugin = DummyPlugin()
        config = plugin.get_config(project=project)
        assert len(config) == 5
        assert config[0] == {
            'default': None,
            'help': 'text field',
            'label': 'Text',
            'name': 'text',
            'placeholder': None,
            'required': True,
            'type': 'text'
        }
        assert config[1] == {
            'default': None,
            'help': '',
            'label': 'Textarea',
            'name': 'textarea',
            'placeholder': None,
            'required': False,
            'type': 'textarea',
        }
        assert config[2] == {
            'default': None,
            'help': '',
            'label': 'A Password',
            'name': 'password',
            'placeholder': None,
            'required': True,
            'type': 'secret',
        }
        assert config[3] == {
            'default': None,
            'help': '',
            'label': 'Choice',
            'name': 'choice',
            'placeholder': None,
            'required': True,
            'type': 'select',
            'choices': [(1, 'one'), (2, 'two')],
        }
        assert config[4] == {
            'default': None,
            'help': '',
            'label': 'Url',
            'name': 'url',
            'placeholder': None,
            'required': True,
            'type': 'url',
        }

    def test_validate_url(self):
        project = self.create_project()
        plugin = DummyPlugin()
        with pytest.raises(PluginError):
            plugin.validate_config_field(
                project=project,
                name='url',
                value='foo',
            )

        value = plugin.validate_config_field(
            project=project,
            name='url',
            value='https://example.com',
        )

        assert value == 'https://example.com'

        value = plugin.validate_config_field(
            project=project,
            name='url',
            value='http://example.com',
        )

        assert value == 'http://example.com'
