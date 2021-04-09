__all__ = ["PluginConfigMixin"]


from collections import OrderedDict

from django import forms
from rest_framework import serializers

from sentry.exceptions import PluginError
from sentry.utils.forms import form_to_config

from .providers import ProviderMixin
from .validators import DEFAULT_VALIDATORS

VALIDATOR_ERRORS = (forms.ValidationError, serializers.ValidationError, PluginError)

ERR_FIELD_REQUIRED = "This field is required."


# TODO(dcramer): replace one-off validation code with standardized validator
# (e.g. project_plugin_details.py)
class ConfigValidator:
    def __init__(self, config, data=None, initial=None, context=None):
        self.errors = {}
        self.result = {}
        self.context = context or {}

        self.config = OrderedDict((f["name"], f) for f in config)

        self._data = data or {}
        self._initial = initial or {}
        self._validated = False

    def is_valid(self):
        data = self._data
        initial = self._initial
        cleaned = self.result
        errors = self.errors
        for field in self.config.values():
            key = field["name"]
            value = data.get(key, initial.get(key))

            if field.get("required") and not value:
                errors[key] = ERR_FIELD_REQUIRED

            try:
                value = self.validate_field(name=key, value=value)
            except (forms.ValidationError, serializers.ValidationError, PluginError) as e:
                errors[key] = str(e)

            if not errors.get(key):
                cleaned[key] = value

        self._validated = True
        return not errors

    def validate_field(self, name, value):
        """
        ```
        if name == 'foo' and value != 'bar':
            raise PluginError('foo must be bar')
        return value
        ```
        """
        field = self.config[name]
        if value is None:
            if field.get("required"):
                raise PluginError("Field is required")
            return value

        if isinstance(value, str):
            value = value.strip()
            # TODO(dcramer): probably should do something with default
            # validations here, though many things will end up bring string
            # based
            if not value and field.get("required"):
                raise PluginError("Field is required")

        for validator in DEFAULT_VALIDATORS.get(field["type"], ()):
            value = validator(value=value)

        for validator in field.get("validators", ()):
            value = validator(value=value, **self.context)
        return value


class PluginConfigMixin(ProviderMixin):
    asset_key = None
    assets = []

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

        return form_to_config(form)

    def validate_config_field(self, project, name, value, actor=None):
        """
        ```
        if name == 'foo' and value != 'bar':
            raise PluginError('foo must be bar')
        return value
        ```
        """
        for config in self.get_config(project=project, user=actor):
            if config["name"] != name:
                continue

            if value is None:
                if config.get("required"):
                    raise PluginError("Field is required")
                if config.get("type") == "secret":
                    value = self.get_option(name, project)
                return value

            if isinstance(value, str):
                value = value.strip()
                # TODO(dcramer): probably should do something with default
                # validations here, though many things will end up bring string
                # based
                if not value:
                    if config.get("required"):
                        raise PluginError("Field is required")
                    if config.get("type") == "secret":
                        value = self.get_option(name, project)

            for validator in DEFAULT_VALIDATORS.get(config["type"], ()):
                value = validator(project=project, value=value, actor=actor)

            for validator in config.get("validators", ()):
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

    def setup(self, bindings):
        pass

    @staticmethod
    def feature_flag_name(f):
        """
        For the time being, we want the features for plugins to be treated separately than integrations
        (integration features prefix with integrations-). This is because in Saas Sentry,
        users can install the Trello and Asana plugins but not Jira even though both utilize issue-commits.
        By not prefixing, we can avoid making new feature flags for data-forwarding which are restricted.
        """
        return f
